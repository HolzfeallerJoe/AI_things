#!/usr/bin/env python3
"""Redact public IPs and usernames locally, without overwriting files."""
import argparse
import codecs
import ipaddress
import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote

IP_MARKER = '[REDACTED_IP]'
USER_MARKER = '[REDACTED_USER]'
SEP = r'(?:\\+|/|%5[cC]|%2[fF])'
PROFILE = re.compile(
    rf'(?P<prefix>(?:[a-z](?::|%3a){SEP}Users{SEP}|(?<![\w/])/(?:Users|home)/))'
    rf'(?P<value>[^\r\n]+?)(?={SEP}|[\r\n]|$)', re.I)
USER_FIELD = re.compile(
    r'''(?P<prefix>(?<![\w-])["']?(?:user[_-]?name|Benutzername)["']?\s*[:=]\s*)'''
    r'''(?P<value>"(?:\\.|[^"\r\n])*"|'(?:\\.|[^'\r\n])*'|[^,;\s\r\n]+)''', re.I)
IPV4 = re.compile(r'(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?![\w.]|(?:%2[eE]\d))')
IPV6 = re.compile(r'(?<![\w:])(?:[0-9a-f]*:){2,}[0-9a-f:.]*(?:%[\w.-]+)?(?![\w:])', re.I)
ENCODED_IP = re.compile(r'(?<!\w)(?:[0-9a-f]+|%3a|%2e)(?:[0-9a-f]|%3a|%2e|[:.])*(?!\w)', re.I)
VERSION_PREFIX = re.compile(r'''(?:\b[\w-]*version|\brelease|\bbuild)["']?\s*[:=]\s*["']?$''', re.I)


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


def is_placeholder(value):
    decoded = unquote(value).strip('\"\'')
    return bool(re.fullmatch(r'(?:\[|<)(?:redacted|anonymized|anonymisiert)[^\]\r\n>]*(?:\]|>)', decoded, re.I))


def transform(text, usernames=()):
    counts = {'public_ips': 0, 'usernames': 0}
    def replace_user(match):
        value = match.group('value')
        if is_placeholder(value) or value.lower() in {'null', 'none', 'undefined', '\"\"', "''"}:
            return match.group(0)
        quote = value[0] if value[0] in '\"\'' else ''
        counts['usernames'] += 1
        return match.group('prefix') + quote + USER_MARKER + quote
    text = PROFILE.sub(replace_user, text)
    text = USER_FIELD.sub(replace_user, text)
    for username in dict.fromkeys(usernames):
        if not username or is_placeholder(username):
            raise ValueError('Additional usernames must be nonempty, non-placeholder values.')
        pattern = re.compile(r'(?<!\w)' + re.escape(username) + r'(?!\w)')
        text, count = pattern.subn(USER_MARKER, text)
        counts['usernames'] += count
    for pattern, encoded in ((ENCODED_IP, True), (IPV6, False), (IPV4, False)):
        original = text
        def replace_ip(match):
            value = match.group(0)
            if encoded and not re.search(r'%3a|%2e', value, re.I):
                return value
            if VERSION_PREFIX.search(original[max(0, match.start()-80):match.start()]):
                return value
            if not is_public(unquote(value) if encoded else value):
                return value
            counts['public_ips'] += 1
            return IP_MARKER
        text = pattern.sub(replace_ip, text)
    return text, counts


def decode(data, encoding=None):
    if encoding:
        return data.decode(encoding), encoding, b''
    for bom, codec in ((codecs.BOM_UTF32_LE, 'utf-32-le'),
                       (codecs.BOM_UTF32_BE, 'utf-32-be'),
                       (codecs.BOM_UTF8, 'utf-8'),
                       (codecs.BOM_UTF16_LE, 'utf-16-le'),
                       (codecs.BOM_UTF16_BE, 'utf-16-be')):
        if data.startswith(bom):
            return data[len(bom):].decode(codec), codec, bom
    if b'\x00' in data:
        raise ValueError('NUL bytes found; supply the encoding explicitly for a BOM-less Unicode log.')
    return data.decode('utf-8'), 'utf-8', b''


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--encoding', help='Explicit source and output encoding')
    parser.add_argument('--username', action='append', default=[], help='Additional exact username')
    parser.add_argument('--check', action='store_true', help='Report remaining matches without writing')
    args = parser.parse_args(argv)
    if sys.version_info < (3, 13):
        parser.error('Python 3.13+ is required for the IP classification rules.')
    try:
        source = args.input.resolve(strict=True)
        text, encoding, bom = decode(source.read_bytes(), args.encoding)
        redacted, counts = transform(text, args.username)
        if args.check:
            print(json.dumps({'remaining_public_ips': counts['public_ips'],
                              'remaining_usernames': counts['usernames']}))
            return 1 if any(counts.values()) else 0
        destination = (args.output or source.with_name(source.stem + '.redacted' + source.suffix)).resolve()
        if destination == source:
            raise ValueError('The output must be a separate file.')
        remaining_text, remaining = transform(redacted, args.username)
        if remaining_text != redacted or any(remaining.values()):
            raise ValueError('Post-redaction validation failed; no output was written.')
        payload = bom + redacted.encode(encoding)
        with destination.open('xb') as output:
            output.write(payload)
        print(json.dumps({'output': str(destination), 'replacements': counts,
                          'remaining_public_ips': 0, 'remaining_usernames': 0,
                          'encoding': encoding}, ensure_ascii=True))
        return 0
    except UnicodeError:
        print('Cannot decode the log losslessly. Specify --encoding; no output was written.', file=sys.stderr)
    except FileExistsError:
        print('The output already exists. Choose a new --output; no file was overwritten.', file=sys.stderr)
    except (OSError, ValueError) as error:
        if isinstance(error, OSError):
            print(f'File operation failed ({type(error).__name__}); check paths and permissions.', file=sys.stderr)
        else:
            print(str(error), file=sys.stderr)
    return 2


if __name__ == '__main__':
    raise SystemExit(main())
