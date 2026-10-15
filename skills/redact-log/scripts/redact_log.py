#!/usr/bin/env python3
"""Local log redaction with per-run aliases and product-aware field rules."""
import argparse
import codecs
import ipaddress
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlsplit, parse_qs

RULES_FILE = Path(__file__).resolve().parents[1] / 'references' / 'product-rules.json'
PLACEHOLDER = re.compile(r'(?:\[(?:REDACTED[^\]\r\n]*|USER|IP|URL|PATH|TOKEN)\]|<(?:Redacted|Anonymized)[^>\r\n]*>)', re.I)
EMAIL = re.compile(r'(?<![\w.+-])[\w.!#$%&\x27*+/=?^`{|}~-]+@[\w-]+(?:\.[\w-]+)+(?![\w.-])')
# yt-dlp's updater prints channel@date.build, which resembles an email.
YTDLP_RELEASE = re.compile(r'(?:stable|nightly|master)@\d{4}\.\d{2}\.\d{2}(?:\.\d+)?')
IPV4 = re.compile(r'(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?![\w.])')
IPV6 = re.compile(r'(?<![\w:])(?:[0-9a-f]*:){2,}[0-9a-f:.]*(?:%[\w.-]+)?(?![\w:])', re.I)
ENCODED_IP = re.compile(r'(?<!\w)(?:[0-9a-f]+|%3a|%2e)(?:[0-9a-f]|%3a|%2e|[:.])*(?!\w)', re.I)
MAC = re.compile(r'(?<![\w:])(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}(?![\w:])', re.I)
JWT = re.compile(r'(?<![\w-])eyJ[\w-]+\.[\w-]+\.[\w-]+(?![\w-])')
UUID = re.compile(r'(?<!\w)[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}(?!\w)', re.I)
SID = re.compile(r'\bS-1-\d+(?:-\d+){2,}\b')
PHONE = re.compile(r'(?<![\w\d])\+\d{1,3}[ ()\d./-]{5,24}\d(?!\w)')
IBAN = re.compile(r'(?<!\w)[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}(?!\w)')
CARD = re.compile(r'(?<![\w.])(?:\d[ -]?){12,18}\d(?![\w.])')
VERSION_PREFIX = re.compile(r'(?:\b[\w-]*version|\brelease|\bbuild)["\x27]?\s*[:=]\s*["\x27]?$', re.I)
URL = re.compile(r'\b(?:https?|wss?|ftp|file|capacitor|content)://[^\s"\x27<>,;{}()]+', re.I)
MEDIA_QUERY = re.compile(r'\bvideoplayback\?[^\s"\x27<>,{}()]+', re.I)
WINDOWS_PATH = re.compile(r'(?i)\b[a-z](?::|%3a)(?:\\+|/|%5c)[^\r\n"\x27<>|]*')
POSIX_PATH = re.compile(r'(?<![\w:])/(?:Users|home|storage|sdcard|data/user|tmp|mnt)/[^\r\n"\x27<>|]*')
FIELD = re.compile(r'(?<![\w:-])(?P<key>"(?:\\.|[^"\\\r\n])*"|\x27[^\x27\r\n]*\x27|(?i:Install[ \t]+mode[ \t]+root[ \t]+key)|[A-Za-z_][\w.-]{0,65})(?P<sep>\s*[:=]\s*)')
DECODER = json.JSONDecoder()
# These names also occur as roles, labels and ordinary words in diagnostic prose.
AMBIGUOUS_USERNAMES = {'user', 'admin', 'administrator', 'guest', 'root', 'system', 'default', 'public'}
REGISTRY_ROOTS = {'HKEY_CLASSES_ROOT', 'HKEY_CURRENT_USER', 'HKEY_LOCAL_MACHINE',
                  'HKEY_USERS', 'HKEY_CURRENT_CONFIG', 'HKEY_PERFORMANCE_DATA',
                  'HKCR', 'HKCU', 'HKLM', 'HKU', 'HKCC', 'HKPD'}

def normalize(key):
    return re.sub(r'[^a-z0-9]', '', key.lower())

def words(value):
    return value.split()

def youtube_video_id(value):
    """Recognize source identity syntactically, without requesting the URL."""
    try:
        parsed = urlsplit(value)
        host = (parsed.hostname or '').lower()
        if parsed.scheme.lower() not in {'http', 'https'} or parsed.username is not None:
            return None
        if host == 'youtu.be':
            video = unquote(parsed.path.strip('/'))
        elif host == 'youtube.com' or host.endswith('.youtube.com'):
            if parsed.path == '/watch':
                video = parse_qs(parsed.query).get('v', [''])[0]
            else:
                match = re.fullmatch(r'/(?:shorts|embed|live)/([^/]+)/?', parsed.path)
                video = unquote(match[1]) if match else ''
        else:
            return None
        return video if re.fullmatch(r'[A-Za-z0-9_-]{11}', video) else None
    except ValueError:
        return None

GENERAL_FIELDS = {}
for category, names in {
    'USER': 'user username user_name user-name loginName accountName Benutzername smtpUser',
    'PERSON': 'firstName lastName fullName givenName familyName displayName customerName employeeName registeredOwner registeredOrganization',
    'EMAIL': 'email emailAddress e-mail mailAddress recipient recipients replyTo cc bcc',
    'PHONE': 'phone phoneNumber telephone mobileNumber Telefonnummer',
    'ADDRESS': 'address street houseNumber postalCode zipCode postcode city homeAddress billingAddress shippingAddress',
    'PERSONAL_DATE': 'dateOfBirth birthDate birthday dob',
    'LOCATION': 'latitude longitude lat lon lng coordinates gps location geolocation locationName',
    'PERSON_ID': 'userId customerId accountId contactId employeeId principalId userTraceId user_trace_id sid passportNumber',
    'DEVICE_ID': 'deviceId deviceUuid installationId installId androidId advertisingId idfa idfv udid imei imsi serialNumber machineId machineGuid hardwareId fingerprint x-v2m-installation-id',
    'DEVICE_NAME': 'deviceName computerName hostName pcName machineName peerName ssid bssid bluetoothName',
    'SESSION_ID': 'sessionId clientSessionId client_session_id requestId request_id traceId correlationId albumDownloadId x-request-id x-user-trace-id',
    'PURCHASE_ID': 'transactionId originalTransactionId transactionIdentifier originalTransactionIdentifier orderId invoiceNumber',
    'FINANCIAL': 'iban bankAccount accountNumber creditCard cardNumber cvv cvc',
    'SECRET': 'password passwd pwd masterPassword token accessToken refreshToken idToken authorization proxy-authorization cookie cookies set-cookie secret clientSecret apiKey api-key key privateKey encryptionKey license licenseKey licenseToken productKey registrationKey registrationCode receipt purchaseToken appStoreReceipt latestReceipt assertion attestation pairToken pairingCode pairingToken pin inviteCode shareToken databaseUrl connectionString x-api-key x-auth-token',
    'CONTENT': 'messageText clipboard clipboardText transcription transcript ocrText documentText recognizedText personalNotes base64 fileData imageData audioData',
    'PATH': 'localPath filePath sourcePath targetPath downloadPath directory keypath keyfile databasePath homeDir userDataPath',
    'FILE': 'fileName filename documentName recordingName safeName',
    'URL': 'url uri href baseUrl streamUrl requestUrl responseUrl endpoint callbackUrl downloadUrl redirectUri',
    'ROUTE': 'path route requestPath requestUri',
}.items():
    for key in words(names):
        GENERAL_FIELDS[normalize(key)] = category

# Keep these values and structural keys even inside a personal payload.
TECHNICAL_FIELDS = set(map(normalize, words('status statusCode status_code code errorCode errorName level scope method methodName event eventName outcome service version platform environment retryable duration duration_ms elapsedMs count amount total totalSize size fileSize contentLength progress currentSpeed eta port mime mimeType type language locale source operation limit since state success enabled connected online expiresIn tokenType tokenLength receiptLength payloadLength')))
PUBLIC_NAMES = set(map(str.casefold, ['YouTube Song Downloader', 'YouTubeSongDownloader', 'Doku Downloader', 'DokuDownloader', 'Mediatheken Downloader', 'MediathekenDownloader', 'Abelssoft X-Loader', 'AbelssoftXLoader', 'KeyDepot', 'SendMe', 'EverDoc', 'BetterRhythm', 'Abelssoft', 'ScamCheck', 'Voice2Mail']))
SAFE_SEGMENTS = set(map(str.casefold, words('Users home AppData Local Roaming LocalLow Documents Downloads Desktop Music Pictures Videos temp tmp storage emulated sdcard data user files cache caches logs runtime resources app.asar app.asar.unpacked node_modules src app dist build electron bin obj Program\x20Files Windows System32 ProgramData Abelssoft X-Loader sendme qrsend youtube-song-downloader voice2mail api v1 v2 v3 health healthCheck token login logout register attestation android apple challenge uploads download upload tasks boards devices sync pair pairing events stream recalls notifications subscriptions manifest.json resources runtime deno ffmpeg')))
SAFE_SEGMENTS.update(PUBLIC_NAMES)
SAFE_FILES = set(map(str.casefold, words('app.log net.log main_process.log logfile.log logfile.txt log.txt requests.jsonl deno.exe ffmpeg.exe yt-dlp.exe yt-dlp cookies.txt manifest.json package.json index.html main.js polyfills.js runtime.js')))
SAFE_DOMAINS = ('abelssoft.de', 'ascora.de', 'youtube.com', 'youtu.be', 'googlevideo.com', 'ytimg.com', 'ardmediathek.de', 'zdf.de', 'kika.de', 'br.de', 'akamaihd.net', 'microsoft.com', 'googleapis.com', 'apple.com')
SAFE_QUERY = set(map(normalize, words('itag mime source requiressl clen dur gir ratebypass rqh fvip txp c limit offset page size count since state platform language lang locale format quality width height version vprv expire expires expiresIn redirect_uri response_type scope grant_type')))

def is_placeholder(value):
    return bool(PLACEHOLDER.fullmatch(unquote(str(value)).strip('"\x27 \t')))

def is_public(value):
    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        return False
    if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
        address = address.ipv4_mapped
    return address.is_global and not any((address.is_multicast, address.is_loopback,
        address.is_link_local, address.is_reserved, address.is_unspecified,
        getattr(address, 'is_site_local', False)))

def decode(data, encoding=None):
    if encoding:
        return data.decode(encoding), encoding, b''
    for bom, codec in ((codecs.BOM_UTF32_LE, 'utf-32-le'), (codecs.BOM_UTF32_BE, 'utf-32-be'),
                       (codecs.BOM_UTF8, 'utf-8'), (codecs.BOM_UTF16_LE, 'utf-16-le'),
                       (codecs.BOM_UTF16_BE, 'utf-16-be')):
        if data.startswith(bom):
            return data[len(bom):].decode(codec), codec, bom
    if b'\x00' in data:
        raise ValueError('NUL bytes found; specify the encoding for a BOM-less Unicode log.')
    return data.decode('utf-8'), 'utf-8', b''

def load_rules(extra=None):
    rules = json.loads(RULES_FILE.read_text(encoding='utf-8-sig'))
    if extra:
        custom = json.loads(Path(extra).read_text(encoding='utf-8-sig'))
        if not isinstance(custom,dict) or not isinstance(custom.get('fields',{}),dict) or not isinstance(custom.get('patterns',[]),list):
            raise ValueError('Invalid custom rule schema')
        rules['profiles']['custom'] = {'detect': [], 'fields': custom.get('fields', {}), 'patterns': custom.get('patterns', [])}
    for profile in rules['profiles'].values():
        for category in profile['fields'].values():
            if not isinstance(category,str) or not re.fullmatch(r'[A-Z][A-Z0-9_]{0,30}',category):
                raise ValueError('Invalid field category')
        for rule in profile.get('patterns',[]):
            try:
                pattern=re.compile(rule['pattern'])
                if 'value' not in pattern.groupindex or not re.fullmatch(r'[A-Z][A-Z0-9_]{0,30}',rule['category']):
                    raise ValueError('Invalid contextual rule')
            except (KeyError,TypeError,re.error):
                raise ValueError('Invalid contextual rule') from None
    return rules

class Redactor:
    def __init__(self, profiles=(), rules=None, usernames=(), values=(), redact_media_ids=False):
        self.rules = rules or load_rules()
        unknown = set(profiles) - self.rules['profiles'].keys() - {'auto'}
        if unknown:
            raise ValueError('Unknown product profile. See --list-products.')
        self.profiles = tuple(profiles) or ('auto',)
        self.mapping = {}
        self.sequence = Counter()
        self.counts = Counter()
        self.learned = {}
        self.fields = dict(GENERAL_FIELDS)
        self.active_profiles = set()
        self.current_profiles = set()
        self.patterns = []
        self.redact_media_ids = redact_media_ids
        self.media_ids = set()
        for value in usernames:
            self.learn('USER', value, explicit=True)
        for item in values:
            if '=' not in item:
                raise ValueError('--value requires CATEGORY=value.')
            category, value = item.split('=', 1)
            if not re.fullmatch(r'[A-Z][A-Z0-9_]{0,30}', category):
                raise ValueError('Invalid --value category.')
            self.learn(category, value, explicit=True)

    def activate(self, text, hint=''):
        chosen = set(self.profiles) - {'auto'}
        if 'auto' in self.profiles:
            lower = (hint+'\n'+text).lower()
            chosen.update(k for k, p in self.rules['profiles'].items()
                          if any(s.lower() in lower for s in p.get('detect', [])))
        if 'custom' in self.rules['profiles']:
            chosen.add('custom')
        self.fields = dict(GENERAL_FIELDS)
        self.patterns=[]
        for name in sorted(chosen):
            self.fields.update({normalize(k): v for k, v in self.rules['profiles'][name]['fields'].items()})
            self.patterns.extend(self.rules['profiles'][name].get('patterns',[]))
        self.active_profiles.update(chosen)
        self.current_profiles=chosen

    def alias(self, category, value):
        value = str(value)
        if not value or is_placeholder(value):
            return value
        canonical = unquote(value)
        if category in {'EMAIL', 'USER', 'HOST', 'DEVICE_NAME', 'MAC'}:
            canonical = canonical.casefold()
        key = (category, canonical)
        if key not in self.mapping:
            self.sequence[category] += 1
            number = self.sequence[category]
            self.mapping[key] = f'[REDACTED_{category}_{number:03d}]'
        self.counts[category] += 1
        return self.mapping[key]

    def learn(self, category, value, explicit=False):
        # Still redact these account names in paths and labeled identity fields.
        # Only an explicit literal override propagates them into unrelated prose.
        if category == 'USER' and not explicit and value.casefold() in AMBIGUOUS_USERNAMES:
            return
        if isinstance(value, str) and len(value) >= 4 and not PLACEHOLDER.search(value):
            self.learned.setdefault(value, category)

    def ip(self, value):
        try:
            address = ipaddress.ip_address(unquote(value))
        except ValueError:
            return value
        if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
            address = address.ipv4_mapped
        if address.is_loopback or address.is_unspecified or address.is_multicast or str(address) == '255.255.255.255':
            return value
        category = 'IP_PUBLIC' if is_public(str(address)) else 'IP_LOCAL'
        return self.alias(category, str(address))

    def field_category(self, key):
        n = normalize(key)
        if n in self.fields:
            return self.fields[n]
        if n in {'installmoderootkey', 'registryroot', 'registryrootkey'}:
            return 'REGISTRY_ROOT'
        if n not in TECHNICAL_FIELDS and (n.endswith('token') or n.endswith('secret') or n.endswith('password')):
            return 'SECRET'
        if n.endswith('email') or n.endswith('emailaddress'):
            return 'EMAIL'
        return None

    def scalar(self, category, value):
        if value is None or isinstance(value, bool) or value == '' or is_placeholder(value):
            return value
        if category == 'REGISTRY_ROOT':
            if isinstance(value, str) and value.upper() in REGISTRY_ROOTS:
                return value
            category = 'SECRET'  # Unknown values and subkey paths are not allowlisted.
        if category!='SECRET' and isinstance(value,str) and value.lower() in {'null','undefined','none'}:
            return value
        if category == 'CONTENT_ID' and not self.redact_media_ids and str(value) in self.media_ids:
            return value
        if category in {'CONTENT', 'DEVICE_NAME'} and isinstance(value, str) and value.casefold() in PUBLIC_NAMES:
            return value
        if category == 'CONTENT' and isinstance(value, str) and re.fullmatch(r'(?:Error|TypeError|ReferenceError|RangeError|SyntaxError|ValueError|HttpErrorResponse|AxiosError|AbortError|TimeoutError)', value):
            return value
        if category == 'PATH':
            return self.path(str(value))
        if category == 'ROUTE':
            value=str(value)
            if re.match(r'[a-zA-Z]:|/(?:Users|home|storage|sdcard|data|tmp)/',value):
                return self.path(value)
            if value.startswith('/'):
                return self.url('http://localhost'+value)[len('http://localhost'):]
            return value
        if category == 'IP':
            return self.ip(str(value))
        if category == 'ADDRESS' and isinstance(value,str):
            masked=self.ip(value)
            if masked!=value:return masked
        if category == 'FILE':
            match = re.search(r'(\.(?:tar\.)?[a-zA-Z0-9]{1,8})$', str(value))
            ext = match[0] if match else ''
            stem = str(value)[:-len(ext)] if ext else str(value)
            return self.alias('FILE',stem) + ext
        if category in {'DEVICE_NAME','CONTENT'} and isinstance(value,str) and re.search(r'\.(?:pdf|docx?|xlsx?|pptx?|png|jpe?g|mp[34]|m4a|wav|ogg|zip|kdbx)$',value,re.I):
            return self.scalar('FILE',value)
        if category == 'URL':
            return self.url(str(value))
        if category == 'SECRET' and isinstance(value, str):
            scheme = re.match(r'^(Bearer|Basic)\s+(.+)$', value, re.I)
            if scheme:
                return scheme[1] + ' ' + self.alias('SECRET', scheme[2])
        if category == 'COMMAND':
            # A shell command may contain free-text arguments or secrets.
            # Preserve the executable name, mask arguments separately.
            m = re.match(r'("[^"]+"|\S+)(.*)', str(value), re.S)
            if not m:
                return self.alias('COMMAND', value)
            exe = self.path(m[1]) if re.search(r'[/\\]', m[1]) else m[1]
            args = m[2]
            return exe + (' ' + self.alias('COMMAND_ARGS', args.strip()) if args.strip() else '')
        if category in {'USER', 'PERSON', 'EMAIL', 'DEVICE_NAME', 'SECRET'}:
            self.learn(category, str(value))
        if category.endswith('_ID') and isinstance(value,str) and UUID.fullmatch(value):
            self.learn(category,value)
        return self.alias(category, value)

    def path(self, value):
        parts = re.split(r'(\\+|/|%5[cC]|%2[fF])', value)
        previous = ''
        for i in range(0, len(parts), 2):
            part = parts[i]
            decoded = unquote(part)
            if not part or is_placeholder(part) or re.fullmatch(r'[a-zA-Z](?::|%3[aA])(?:\s*)|\d+', part):
                previous = decoded
                continue
            trailing = re.search(r'(\s+|:\d+(?::\d+)?\)?)$', part)
            suffix = trailing.group() if trailing else ''
            core = part[:-len(suffix)] if suffix else part
            if PLACEHOLDER.search(core):
                previous = decoded
                continue
            if previous.casefold() in {'users', 'home'}:
                self.learn('USER', unquote(core))
                parts[i] = self.alias('USER', core) + suffix
            elif core.casefold() in SAFE_SEGMENTS or core.casefold() in SAFE_FILES or core.casefold() in PUBLIC_NAMES:
                pass
            elif re.search(r'\.(?:js|ts|mjs|cjs|py|java|cs|kt|swift|dll|exe|map)$', core, re.I) and any(p.casefold() in {'src','node_modules','resources','bin','runtime','app.asar'} for p in parts[:i]):
                pass  # Stack-frame source names and runtime binaries are diagnostic.
            else:
                ext = re.search(r'(\.[a-zA-Z0-9]{1,8})$', core)
                ending = ext.group() if ext else ''
                stem = core[:-len(ending)] if ending else core
                parts[i] = self.alias('FILE' if ending else 'PATH_SEGMENT', stem) + ending + suffix
            previous = decoded
        return ''.join(parts)

    def url(self, value):
        m = re.match(r'(?P<scheme>[\w+.-]+://)(?P<host>[^/?#]*)(?P<path>[^?#]*)(?P<query>\?[^#]*)?(?P<frag>#.*)?$', value)
        if not m:
            return self.alias('URL', value)
        scheme, host, path, query, fragment = (m.group(k) or '' for k in ['scheme','host','path','query','frag'])
        video_id = youtube_video_id(value) if 'media' in self.current_profiles and not self.redact_media_ids else None
        if video_id:
            self.media_ids.add(video_id)
        if '@' in host:
            credentials, host = host.rsplit('@', 1)
            host = self.alias('SECRET', credentials) + '@' + host
        # Keep scheme, ports and known public service domains; alias private/custom hosts.
        actual = host.rsplit('@', 1)[-1]
        bracketed = re.match(r'^\[([^]]+)\](:\d+)?$', actual)
        host_only, port = (bracketed[1], bracketed[2] or '') if bracketed else (re.sub(r':\d+$', '', actual), (re.search(r':\d+$', actual).group() if re.search(r':\d+$', actual) else ''))
        already_masked = bool(PLACEHOLDER.search(actual))
        if not already_masked and host_only not in {'localhost', '127.0.0.1', '::1', ''}:
            masked = self.ip(host_only)
            if masked == host_only and not any(host_only.lower() == d or host_only.lower().endswith('.'+d) for d in SAFE_DOMAINS):
                masked = self.alias('HOST', host_only)
            host = (host[:host.rfind('@')+1] if '@' in host else '') + masked + port
        if scheme.lower() in {'file://', 'content://'}:
            path = self.path(path)
        else:
            segments = path.split('/')
            token_next = False
            for i, part in enumerate(segments):
                if not part or is_placeholder(part):
                    continue
                if token_next:
                    segments[i] = self.alias('SECRET', part)
                    token_next = False
                elif video_id and unquote(part) == video_id:
                    pass
                elif part.casefold() in {'box','f','u','z','invite','share'} and 'sendme' in self.current_profiles:
                    token_next = True
                elif part.casefold() not in SAFE_SEGMENTS and not re.fullmatch(r'(?:voice2mail3?\.php|videoplayback|watch|shorts|embed|live|channel|playlist|search|favicon\.ico)', part, re.I):
                    # Preserve source module paths, otherwise hide user-selected resource segments.
                    if not re.search(r'\.(?:js|css|map|wasm)$', part, re.I):
                        segments[i] = self.alias('URL_PATH', part)
            path = '/'.join(segments)
        if query:
            items = re.split(r'(&|;)', query[1:])
            for i in range(0, len(items), 2):
                key, sep, val = items[i].partition('=')
                if not sep or not val or is_placeholder(val):
                    continue
                n = normalize(unquote(key))
                category = self.field_category(unquote(key))
                if n in {'ip','clientip','remoteip'}:
                    val = self.ip(unquote(val))
                elif video_id and n == 'v' and unquote(val) == video_id:
                    pass
                elif category:
                    val = str(self.scalar(category, unquote(val)))
                elif n in {'v','id','videoid','channelid'} and 'media' in self.current_profiles:
                    val=self.alias('CONTENT_ID',unquote(val))
                elif n not in SAFE_QUERY:
                    val = self.alias('URL_VALUE', unquote(val))
                items[i] = key + sep + val
            query = '?' + ''.join(items)
        if fragment and not is_placeholder(fragment[1:]):
            fragment = '#' + self.alias('URL_FRAGMENT', fragment[1:])
        return scheme + host + path + query + fragment

    def leaf_spans(self, text, start, category):
        """Return edits for scalar leaves, keeping JSON containers and formatting."""
        value, end = DECODER.raw_decode(text, start)
        spans = []
        def walk(pos, inherited):
            while pos < end and text[pos].isspace():
                pos += 1
            val, finish = DECODER.raw_decode(text, pos)
            if isinstance(val, dict):
                cur = pos + 1
                while cur < finish - 1:
                    while text[cur].isspace() or text[cur] == ',':
                        cur += 1
                    if text[cur] == '}':
                        break
                    key, after_key = DECODER.raw_decode(text, cur)
                    cur = after_key
                    while text[cur].isspace() or text[cur] == ':':
                        cur += 1
                    child_category = self.field_category(key) or inherited
                    if normalize(key) in TECHNICAL_FIELDS:
                        child_category = None
                    cur = walk(cur, child_category)
            elif isinstance(val, list):
                cur = pos + 1
                while cur < finish - 1:
                    while text[cur].isspace() or text[cur] == ',':
                        cur += 1
                    if text[cur] == ']':
                        break
                    cur = walk(cur, inherited)
            elif inherited:
                replacement = self.scalar(inherited, val)
                if replacement != val:
                    spans.append((pos, finish, json.dumps(replacement, ensure_ascii=False)))
            return finish
        walk(start, category)
        return spans, end

    def assignments(self, text):
        edits = []
        occupied = 0
        # Query values are handled by url(), never by free-text field parsing.
        # Otherwise sig=secret&itag=251&dur=42 would become one secret alias.
        url_spans = sorted([m.span() for pattern in (URL, MEDIA_QUERY) for m in pattern.finditer(text)])
        url_index = 0
        for m in FIELD.finditer(text):
            if m.start() < occupied:
                continue
            while url_index < len(url_spans) and url_spans[url_index][1] <= m.start():
                url_index += 1
            if url_index < len(url_spans) and url_spans[url_index][0] <= m.start() < url_spans[url_index][1]:
                continue
            raw_key = m['key']
            try:
                key = json.loads(raw_key) if raw_key.startswith('"') else raw_key.strip('\x27')
            except ValueError:
                continue
            category = self.field_category(key)
            if not category:
                continue
            start = m.end()
            if start >= len(text):
                continue
            if PLACEHOLDER.match(text,start):
                continue
            try:
                if text[start] not in '"[{0123456789-tfn':
                    raise ValueError('Not a JSON value')
                spans, end = self.leaf_spans(text, start, category)
                # raw_decode accepts the numeric prefix of an unquoted phone/UUID/path.
                if end < len(text) and text[end] not in ' \t\r\n,;}]':
                    raise ValueError('Not a complete JSON value')
                edits.extend(spans)
                occupied = end
                continue
            except (ValueError, IndexError, RecursionError):
                pass
            if text[start] == '\x27':
                match = re.match(r"'([^'\r\n]*)'", text[start:])
                if not match:
                    continue
                val = match[1]
                end = start + len(match[0])
                replacement = "'" + str(self.scalar(category, val)) + "'"
            elif text[start] in '{["':
                # Already masked or incomplete/multiline data. Never eat following records.
                continue
            else:
                match = re.match(r'[^\s,;}]+' if category=='URL' else r'[^\r\n,;}]+', text[start:])
                if not match:
                    continue
                val = match[0].rstrip()
                if category not in {'PATH','URL'} and not PLACEHOLDER.search(val):
                    val = val.rstrip('])')
                end = start + len(val)
                replacement = str(self.scalar(category, val))
            if replacement != text[start:end]:
                edits.append((start, end, replacement))
            occupied = end
        chunks = []
        cursor = 0
        for start, end, value in edits:
            if start < cursor:
                raise ValueError('Overlapping redaction spans')
            chunks.extend((text[cursor:start], value))
            cursor = end
        chunks.append(text[cursor:])
        return ''.join(chunks)

    def scrub(self, text, detect=True):
        if detect:
            self.activate(text)
        # Redact PEM bodies before they can leak through line-oriented matching.
        pem = re.compile(r'(?P<head>-----BEGIN [^-\r\n]*(?:PRIVATE KEY|CERTIFICATE)-----)(?P<body>.*?)(?P<tail>-----END [^-\r\n]+-----)', re.S)
        def redact_pem(m):
            lines = m['body'].splitlines(keepends=True)
            if all(not l.strip() or is_placeholder(l.strip()) for l in lines):
                return m[0]
            marker = self.alias('SECRET', m['body'])
            return m['head'] + ''.join((marker if l.strip() else '') + ('\r\n' if l.endswith('\r\n') else '\n' if l.endswith('\n') else '') for l in lines) + m['tail']
        text = pem.sub(redact_pem, text)
        # Ionic/X-Core exports sometimes store a JSON object inside a JSON string.
        quoted = re.compile(r'"(?:\\.|[^"\\])*"')
        def embedded(m):
            if '\\"' not in m[0]:
                return m[0]
            try:
                value = json.loads(m[0])
            except ValueError:
                return m[0]
            if not isinstance(value, str) or not value.lstrip().startswith(('{','[')):
                return m[0]
            changed = self.assignments(value)
            return json.dumps(changed,ensure_ascii=False) if changed != value else m[0]
        text = quoted.sub(embedded,text)
        text = self.assignments(text)
        for rule in self.patterns:
            pattern=re.compile(rule['pattern'],re.I|re.M)
            def contextual(m):
                value=m['value']
                changed=str(self.scalar(rule['category'],value))
                start,end=m.span('value')
                return m[0][:start-m.start()]+changed+m[0][end-m.start():]
            text=pattern.sub(contextual,text)
        text = re.sub(r'(?im)(\b(?:Authorization|Proxy-Authorization)\s*:\s*(?:Bearer|Basic)\s+)([^\s,;]+)', lambda m: m[1]+self.alias('SECRET', m[2]), text)
        text = JWT.sub(lambda m: self.alias('SECRET', m[0]), text)
        text = URL.sub(lambda m: self.url(m[0]), text)
        # yt-dlp error lines often omit the host and print just videoplayback?...
        text = MEDIA_QUERY.sub(lambda m: self.url('https://googlevideo.com/' + m[0])[len('https://googlevideo.com/'):], text)
        def redact_path(m):
            original = m[0]
            end = re.search(r'\s+(?:to\s+(?=[a-zA-Z]:)|from\s+(?=[a-zA-Z]:)|Error:|ENOENT\b|ENOTDIR\b|EACCES\b|at\s)|[,;]\s*\w+\s*=', original)
            head = original[:end.start()] if end else original
            return self.path(head) + original[len(head):]
        text = WINDOWS_PATH.sub(redact_path, text)
        text = POSIX_PATH.sub(redact_path, text)
        text = EMAIL.sub(lambda m: m[0] if YTDLP_RELEASE.fullmatch(m[0]) else self.scalar('EMAIL', m[0]), text)
        for pattern, encoded in ((ENCODED_IP, True), (IPV6, False), (IPV4, False)):
            original = text
            def replace_ip(m):
                if encoded and not re.search(r'%3a|%2e', m[0], re.I):
                    return m[0]
                if VERSION_PREFIX.search(original[max(0,m.start()-80):m.start()]):
                    return m[0]
                return self.ip(m[0])
            text = pattern.sub(replace_ip, text)
        text = MAC.sub(lambda m: self.alias('MAC', m[0]), text)
        text = UUID.sub(lambda m: self.alias(self.learned.get(m[0],'IDENTIFIER'), m[0]), text)
        text = SID.sub(lambda m: self.alias('PERSON_ID', m[0]), text)
        text = PHONE.sub(lambda m: self.alias('PHONE', m[0]) if 7 <= len(re.sub(r'\D','',m[0])) <= 15 else m[0], text)
        def redact_iban(m):
            value = m[0].replace(' ', '')
            number = ''.join(str(ord(c)-55) if c.isalpha() else c for c in value[4:]+value[:4])
            return self.alias('FINANCIAL', value) if 15 <= len(value) <= 34 and int(number) % 97 == 1 else m[0]
        text = IBAN.sub(redact_iban, text)
        def redact_card(m):
            value = re.sub(r'\D','',m[0])
            digits = list(map(int,value[::-1]))
            checksum = sum(d if i%2 == 0 else (d*2-9 if d>4 else d*2) for i,d in enumerate(digits))
            recognized=(len(value) in {13,16,19} and value.startswith('4')) or (len(value)==15 and value.startswith(('34','37'))) or (len(value)==16 and (value.startswith(('51','52','53','54','55','6011','65')) or 2221<=int(value[:4])<=2720))
            return self.alias('FINANCIAL',value) if recognized and len(set(value))>1 and checksum%10==0 else m[0]
        text = CARD.sub(redact_card, text)
        # Learned personal values also occur in prose, JSON strings and exception text.
        if self.learned:
            candidates = sorted(self.learned, key=len, reverse=True)
            pattern = re.compile(r'(?<!\w)(?:'+ '|'.join(re.escape(v) for v in candidates)+r')(?!\w)')
            text = pattern.sub(lambda m: self.alias(self.learned[m[0]],m[0]), text)
        return text

    def transform(self, text, hint=''):
        self.activate(text,hint)
        if 'media' in self.current_profiles and not self.redact_media_ids:
            self.media_ids.update(video for m in URL.finditer(text) if (video := youtube_video_id(m[0])))
        # First pass learns contextual identities; second propagates them to earlier lines.
        result = self.scrub(text, detect=False)
        return self.scrub(result, detect=False)

def transform(text, usernames=(), profiles=('auto',)):
    redactor = Redactor(profiles=profiles, usernames=usernames)
    result = redactor.transform(text)
    return result, dict(redactor.counts)

TIMESTAMP = re.compile(r'(?<!\d)(?:\d{2}-\d{2}-\d{4}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?|\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:\d{2})?)(?!\d)')

def parse_timestamp(value):
    if re.match(r'\d{2}-',value):
        return datetime.strptime(value.replace('T',' ').replace(',','.'), '%d-%m-%Y %H:%M:%S'+('.%f' if '.' in value or ',' in value else '')).replace(tzinfo=timezone.utc)
    parsed=datetime.fromisoformat(value.replace(',','.').replace('Z','+00:00'))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)

def shift_timestamps(texts):
    stamps=[]
    epoch_pattern=re.compile(r'(?P<prefix>["\x27]?(?:timestamp|time|ts|at|expire|expires)["\x27]?\s*[:=]\s*)(?P<value>\d{10}|\d{13})(?!\d)',re.I)
    for text in texts:
        for m in TIMESTAMP.finditer(text):
            try:stamps.append(parse_timestamp(m[0]).timestamp())
            except ValueError:pass
        for m in epoch_pattern.finditer(text):
            val=int(m['value']);stamps.append(val/1000 if len(m['value'])==13 else val)
    if not stamps:return texts
    offset=datetime(2000,1,1,tzinfo=timezone.utc).timestamp()-min(stamps)
    def replace(m):
        value=m[0]
        try:
            parsed=parse_timestamp(value)
            changed=datetime.fromtimestamp(parsed.timestamp()+offset,parsed.tzinfo)
        except (ValueError,OverflowError):return value
        if re.match(r'\d{2}-',value):
            result=changed.strftime('%d-%m-%Y')+value[10]+changed.strftime('%H:%M:%S')
        else:
            result=changed.strftime('%Y-%m-%d')+value[10]+changed.strftime('%H:%M:%S')
        fraction=re.search(r'[.,](\d+)',value)
        if fraction:result+=value[fraction.start()]+f'{changed.microsecond:06d}'[:len(fraction[1])]
        zone=re.search(r'(Z|[+-]\d{2}:\d{2})$',value)
        return result+(zone[0] if zone else '')
    results=[]
    for text in texts:
        text=TIMESTAMP.sub(replace,text)
        def epoch(m):
            divisor=1000 if len(m['value'])==13 else 1
            return m['prefix']+str(round(int(m['value'])+offset*divisor))
        results.append(epoch_pattern.sub(epoch,text))
    return results

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', nargs='*', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--output-dir', type=Path)
    parser.add_argument('--encoding')
    parser.add_argument('--username', action='append', default=[])
    parser.add_argument('--value', action='append', default=[], help='Extra sensitive value as CATEGORY=value')
    parser.add_argument('--product', action='append', default=[], help='Product profile; default auto')
    parser.add_argument('--rules', type=Path, help='Extra local JSON field rules')
    parser.add_argument('--check', action='store_true', help='Scan without writing; zero is not a full privacy review')
    timing = parser.add_mutually_exclusive_group()
    timing.add_argument('--keep-timestamps', action='store_true', help='Keep exact technical event timestamps (the default; retained for compatibility)')
    timing.add_argument('--shift-timestamps', action='store_true', help='Shift event and URL expiry timestamps together for stricter sharing privacy')
    parser.add_argument('--redact-media-ids', action='store_true', help='Alias YouTube source video IDs as private usage information; default preserves reproduction URLs in media logs')
    parser.add_argument('--list-products', action='store_true')
    args = parser.parse_args(argv)
    if sys.version_info < (3,13):
        parser.error('Python 3.13+ is required.')
    try:
        rules = load_rules(args.rules)
        if args.list_products:
            print('\n'.join(['auto'] + list(rules['profiles'])))
            return 0
        if not args.input:
            parser.error('Provide at least one input log.')
        if args.output and (len(args.input)!=1 or args.output_dir):
            parser.error('--output needs one input and cannot be combined with --output-dir.')
        sources = [p.resolve(strict=True) for p in args.input]
        if len(set(sources)) != len(sources):
            raise ValueError('Duplicate input files.')
        contents = [decode(p.read_bytes(), args.encoding) for p in sources]
        redactor = Redactor(args.product, rules, args.username, args.value, args.redact_media_ids)
        # Learn across the whole batch; maps stay in memory only.
        for source,(text, _, _) in zip(sources,contents):
            redactor.transform(text,str(source))
        redactor.counts.clear()
        results = [redactor.transform(text,str(source)) for source,(text, _, _) in zip(sources,contents)]
        if args.check:
            print(json.dumps({'detectable_matches':dict(redactor.counts), 'profiles':sorted(redactor.active_profiles),
                              'manual_review_required':True}))
            return 1 if redactor.counts else 0
        destinations = [(args.output or (args.output_dir or source.parent)/(source.stem+'.redacted'+source.suffix)).resolve() for source in sources]
        if len(set(destinations)) != len(destinations) or any(p in sources or p.exists() for p in destinations):
            raise ValueError('Outputs must be unique new files, separate from all inputs.')
        # Check before writing anything. No raw mappings or snippets leave this process.
        verify = Redactor(args.product, rules, redact_media_ids=args.redact_media_ids)
        # A metadata record may be in one file and its source URL in another.
        for source,result in zip(sources,results):
            verify.transform(result,str(source))
        for source,result in zip(sources,results):
            if verify.transform(result,str(source)) != result:
                raise ValueError('Residual redaction matches found; no output was written.')
        payloads = [bom+result.encode(encoding) for result, (_,encoding,bom) in zip(results,contents)]
        if args.shift_timestamps:
            results=shift_timestamps(results)
            payloads=[bom+result.encode(encoding) for result,(_,encoding,bom) in zip(results,contents)]
        for destination, payload in zip(destinations,payloads):
            with destination.open('xb') as output:
                output.write(payload)
        print(json.dumps({'outputs':list(map(str,destinations)), 'replacements':dict(redactor.counts),
                          'profiles':sorted(redactor.active_profiles), 'timeline_shifted':args.shift_timestamps,
                          'media_source_ids_preserved':not args.redact_media_ids and 'media' in redactor.active_profiles,
                          'manual_review_required':True}, ensure_ascii=True))
        return 0
    except UnicodeError:
        print('Lossless decoding failed; specify --encoding. No output was written.',file=sys.stderr)
    except (OSError,ValueError,RecursionError) as error:
        # Do not repeat a malformed JSON value, secret, or customer path in diagnostics.
        print(f'Redaction failed ({type(error).__name__}); check inputs, rules, encoding and unused output paths.',file=sys.stderr)
    return 2

if __name__ == '__main__':
    raise SystemExit(main())
