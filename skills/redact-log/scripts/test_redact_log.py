"""Functional regression checks with synthetic identities only."""
import codecs
import contextlib
import io
import json
import re
import tempfile
import unittest
from pathlib import Path

import redact_log as rl

class RedactionTests(unittest.TestCase):
    def clean(self, source, product='general'):
        redactor = rl.Redactor([product])
        result = redactor.transform(source)
        self.assertEqual(rl.Redactor([product]).transform(result), result, 'output must be idempotent')
        self.assertEqual(source.count('\n'), result.count('\n'), 'record boundaries must survive')
        return result

    def test_network_types_and_versions(self):
        source = ('version="8.8.8.8" IP=8.8.4.4 LAN=192.168.1.2 LAN=192.168.1.2 '
                  'v6=2001:4860:4860::8888 mapped=::ffff:8.8.4.4 '
                  'encoded=2001%3A4860%3A4860%3A%3A8844\r\n'
                  '127.0.0.1 ::1 0.0.0.0 224.0.0.1 ff02::1 time=18:57:17')
        result = self.clean(source)
        self.assertIn('version="8.8.8.8"', result)
        self.assertIn('127.0.0.1 ::1 0.0.0.0 224.0.0.1 ff02::1 time=18:57:17', result)
        self.assertNotIn('8.8.4.4', result)
        self.assertEqual(re.findall(r'LAN=(\S+)',result), ['[REDACTED_IP_LOCAL_001]']*2)

    def test_names_and_path_relationships(self):
        source = ('Earlier: Alice Smith\r\nusername="Alice Smith"\r\n'
                  'C:\\Users\\Alice Smith\\Documents\\Private project\\report.pdf\r\n'
                  r'C:\\Users\\Alice Smith\\Documents\\Private project\\report.pdf'+'\r\n'
                  'sourcePath="D:\\Video\\Band - Album\\song.mp3"\r\n'
                  'targetPath="D:\\Music\\Band - Album\\song.mp3"\r\n'
                  'C:\\Users\\[USER]\\AppData\\Local\\app.log\r\n')
        result = self.clean(source)
        self.assertNotIn('Alice Smith',result)
        self.assertNotIn('Private project',result)
        self.assertIn('report',source)
        self.assertNotIn('report',result)
        paths = re.findall(r'(?:source|target)Path="([^"]+)"',result)
        self.assertEqual(len(paths),2)
        self.assertNotEqual(paths[0],paths[1])
        self.assertEqual(paths[0].split('\\')[-2:], paths[1].split('\\')[-2:])
        self.assertIn('[USER]',result)
        self.assertIn('app.log',result)

    def test_structured_credentials_and_payloads(self):
        source = json.dumps({'service':'voice2mail-api','requestId':'abc-12345678',
            'authorization':'Bearer abcSuperSecretToken', 'receipt':{'data':'secretReceipt','status':200},
            'recipients':['person@example.net','second@example.net'],
            'location':{'name':'Private street','coordinates':'52.5,13.4'},
            'body':{'text':'Private words','count':4,'errorCode':'SMTP_FAILED'},
            'status':503,'elapsedMs':15,'retryable':True,'stack':'at convert (C:\\Users\\Alice\\Projects\\src\\audio.ts:42:7)'})
        result = self.clean(source,'voice2mail')
        parsed = json.loads(result)
        self.assertEqual(parsed['status'],503)
        self.assertEqual(parsed['elapsedMs'],15)
        self.assertTrue(parsed['retryable'])
        self.assertEqual(parsed['body']['count'],4)
        self.assertEqual(parsed['body']['errorCode'],'SMTP_FAILED')
        self.assertTrue(parsed['authorization'].startswith('Bearer [REDACTED_SECRET_'))
        self.assertEqual(len(parsed['recipients']),2)
        self.assertIn('audio.ts:42:7',parsed['stack'])
        for personal in ['person@example.net','Private street','52.5,13.4','Private words','secretReceipt','Alice']:
            self.assertNotIn(personal,result)

    def test_embedded_json_and_nested_objects(self):
        source=json.dumps({'message':[json.dumps({'sessionId':'client-12345678','email':'alice@example.net','status':400})]})
        result=self.clean(source,'foodrecall')
        inner=json.loads(json.loads(result)['message'][0])
        self.assertEqual(inner['status'],400)
        self.assertNotIn('client-12345678',result)
        self.assertNotIn('alice@example.net',result)

    def test_urls_and_pair_tokens(self):
        source=('https://www.youtube.com/watch?v=personalVideoId\n'
                'https://rr1.googlevideo.com/videoplayback?ip=8.8.8.8&sig=secretSignature&itag=140&dur=12.5\n'
                'http://192.168.1.2:8443/box/privatePairToken/manifest.json\n')
        result=self.clean(source,'sendme')
        self.assertIn('itag=140&dur=12.5',result)
        self.assertIn('googlevideo.com/videoplayback',result)
        self.assertIn(':8443/box/[REDACTED_SECRET_',result)
        for private in ['personalVideoId','8.8.8.8','secretSignature','192.168.1.2','privatePairToken']:
            self.assertNotIn(private,result)

    def test_flat_log_delimiters_and_error_names(self):
        source='url=https://www.youtube.com/watch?v=personalVideo, description=Personal text, name=HttpErrorResponse, status=400, errorCode=ENOENT, duration=15\n'
        result=self.clean(source,'media')
        for technical in ['name=HttpErrorResponse,','status=400,','errorCode=ENOENT,','duration=15']:
            self.assertIn(technical,result)
        self.assertNotIn('Personal text',result)

    def test_encoded_paths_and_prose_context(self):
        source='C%3A%5CUsers%5CAlice%20Smith%5CDocuments%5Cprivate.pdf\n'
        result=self.clean(source)
        self.assertNotIn('Alice',result)
        self.assertIn('C%3A%5CUsers%5C[REDACTED_USER_',result)
        result=self.clean('Attempt to create a backup safe for Private safe.kdbx\n','keydepot')
        self.assertNotIn('Private safe',result)
        self.assertIn('.kdbx',result)

    def test_shifted_timeline_preserves_intervals(self):
        texts=['08-10-2026 10:53:34.250 start\n08-10-2026 10:53:36.750 end\n',
               '{"timestamp":"2026-10-08T10:53:35.250Z","elapsedMs":2500}']
        shifted=rl.shift_timestamps(texts)
        self.assertIn('01-01-2000 00:00:00.000',shifted[0])
        self.assertIn('01-01-2000 00:00:02.500',shifted[0])
        self.assertIn('2000-01-01T00:00:01.000Z',shifted[1])
        self.assertEqual(json.loads(shifted[1])['elapsedMs'],2500)
        self.assertEqual(rl.shift_timestamps(shifted),shifted)

    def test_profile_hint_and_shared_ids(self):
        source='sessionId=01234567-89ab-cdef-0123-456789abcdef\nagain 01234567-89ab-cdef-0123-456789abcdef\n'
        r=rl.Redactor();result=r.transform(source,'foodrecall-client.log')
        self.assertIn('foodrecall',r.active_profiles)
        ids=re.findall(r'\[REDACTED_SESSION_ID_\d+\]',result)
        self.assertEqual(len(ids),2)
        self.assertEqual(ids[0],ids[1])

    def test_context_profiles_keep_errors(self):
        for profile,key,value in [('media','album','Private selection'),('keydepot','safeName','Personal safe'),
                                  ('scamcheck','transactionId','GPA.private.123'),('abc-todo','title','My todo'),
                                  ('triply','destination','Private destination'),('timeflow','reason','Private reason'),
                                  ('everdoc','ocrText','Private document'),('tabtimekeeper','title','Private page'),
                                  ('better-rhythm','windowTitle','Private window'),('pcchangemonitor','registeredOwner','Alice Smith')]:
            with self.subTest(profile=profile):
                source=json.dumps({key:value,'errorCode':'ENOENT','status':500,'count':3})
                result=self.clean(source,profile)
                self.assertNotIn(value,result)
                self.assertEqual(json.loads(result)['errorCode'],'ENOENT')

    def test_free_text_contacts_financial_and_pem(self):
        source=('Contact alice@example.net phone +49 170 1234567\n'
                'IBAN DE89 3704 0044 0532 0130 00 card 4111 1111 1111 1111\n'
                'mac AA:BB:CC:DD:EE:FF\n'
                '-----BEGIN PRIVATE KEY-----\nsecretBase64Here\n-----END PRIVATE KEY-----\n')
        result=self.clean(source)
        for value in ['alice@example.net','170 1234567','3704','4111','AA:BB:CC','secretBase64Here']:
            self.assertNotIn(value,result)
        self.assertIn('-----BEGIN PRIVATE KEY-----',result)

    def test_cli_originals_and_batch_correlation(self):
        for bom,encoding in [(b'','utf-8'),(codecs.BOM_UTF8,'utf-8'),(codecs.BOM_UTF16_LE,'utf-16-le')]:
            with self.subTest(encoding=encoding,bom=bom),tempfile.TemporaryDirectory() as folder:
                first=Path(folder)/'one.log'; second=Path(folder)/'two.log'
                data=bom+'Grüße\r\nemail=alice@example.net\r\n'.encode(encoding)
                first.write_bytes(data);second.write_bytes(data)
                with contextlib.redirect_stdout(io.StringIO()),contextlib.redirect_stderr(io.StringIO()):
                    self.assertEqual(rl.main([str(first),str(second),'--product','general']),0)
                    output=first.with_name('one.redacted.log')
                    self.assertEqual(output.read_bytes(),second.with_name('two.redacted.log').read_bytes())
                    self.assertTrue(output.read_bytes().startswith(bom))
                    self.assertEqual(rl.main([str(output),'--check','--product','general']),0)
                    self.assertEqual(rl.main([str(first),'--check']),1)
                    self.assertEqual(rl.main([str(first)]),2)
                    self.assertEqual(rl.main([str(first),'--output',str(first)]),2)
                self.assertEqual(first.read_bytes(),data)
                self.assertEqual(second.read_bytes(),data)

if __name__=='__main__':
    unittest.main()
