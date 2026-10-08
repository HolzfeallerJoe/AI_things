"""Functional checks using synthetic logs only."""
import codecs
import contextlib
import io
import tempfile
import unittest
from pathlib import Path

import redact_log


class RedactionTests(unittest.TestCase):
    def test_addresses_and_nonpublic_addresses(self):
        source = ('ip=8.8.8.8 ip=2001:4860:4860::8888 '
                  'ip=::ffff:8.8.4.4 ip=2001%3A4860%3A4860%3A%3A8844 '
                  'ip=8%2E8%2E4%2E4\r\n'
                  '127.0.0.1 192.168.1.2 10.0.0.1 100.64.0.1 ::1 '
                  'fe80::1 224.0.0.1 192.0.2.1 ff02::1 fec0::1\r\n'
                  'version=26.16.0.1166 version="8.8.8.8" 18:57:17')
        result, counts = redact_log.transform(source)
        self.assertEqual(counts, {'public_ips': 5, 'usernames': 0})
        self.assertIn(source.split('\r\n')[1], result)
        self.assertIn(source.split('\r\n')[2], result)
        self.assertEqual(redact_log.transform(result)[0], result)

    def test_profile_paths_fields_and_known_names(self):
        source = ('C:\\Users\\Alice Smith\\AppData\r\n'
                  r'C:\\Users\\Alice Smith\\AppData' + '\r\n'
                  'file:///C:/Users/Alice%20Smith/AppData\r\n'
                  'C%3A%5CUsers%5CAlice%20Smith%5CAppData\r\n'
                  '/home/alice/cache\r\n'
                  'username="Alice Smith", Benutzername=alice\r\n'
                  'Logged in as Alice Smith\r\n'
                  'C:\\Users\\<Redacted Username>\\AppData\r\n')
        result, counts = redact_log.transform(source, ['Alice Smith'])
        self.assertEqual(counts, {'public_ips': 0, 'usernames': 8})
        self.assertNotIn('Alice', result)
        self.assertIn('<Redacted Username>', result)
        self.assertEqual(redact_log.transform(result, ['Alice Smith'])[0], result)

    def test_file_copy_encoding_and_no_overwrite(self):
        for bom, encoding in ((b'', 'utf-8'), (codecs.BOM_UTF8, 'utf-8'),
                              (codecs.BOM_UTF16_LE, 'utf-16-le')):
            with self.subTest(encoding=encoding, bom=bom), tempfile.TemporaryDirectory() as folder:
                source = Path(folder) / 'app.log'
                original = bom + 'Grüße\r\nIP=8.8.8.8\r\n'.encode(encoding)
                source.write_bytes(original)
                with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    self.assertEqual(redact_log.main([str(source)]), 0)
                    output = source.with_name('app.redacted.log')
                    self.assertEqual(output.read_bytes(), bom + 'Grüße\r\nIP=[REDACTED_IP]\r\n'.encode(encoding))
                    self.assertEqual(redact_log.main([str(output), '--check']), 0)
                    self.assertEqual(redact_log.main([str(source), '--check']), 1)
                    self.assertEqual(redact_log.main([str(source)]), 2)
                    self.assertEqual(redact_log.main([str(source), '--output', str(source)]), 2)
                self.assertEqual(source.read_bytes(), original)


if __name__ == '__main__':
    unittest.main()
