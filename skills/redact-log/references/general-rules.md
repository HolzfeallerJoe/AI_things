# General rules and diagnostic preservation

## Remove or alias

- People and contacts: usernames in Windows, POSIX and URL-encoded paths; account/login names; personal names; emails; phone numbers; postal addresses; birthdays; contact/employee/customer/account identifiers. Generic `name` is ambiguous. Use the object context to distinguish a person, user-selected item, public product name or exception class.
- Network and device identity: public IPs, private host IPs, MAC addresses, Wi-Fi names, computer and peer names, installation/device/advertising identifiers, serials, Android IDs, IMEI/IMSI, Windows account SIDs. Keep loopback and network protocol metadata. A shared or reserved unicast address can still expose the user's environment.
- Authentication and access: passwords, API keys, OAuth/Bearer/Basic values, refresh/ID tokens, JWTs, cookies, database connection credentials, private keys, QR/PIN/share/pairing/invite codes, attestation/integrity assertions and license/registration codes. Also redact purchase receipts, transaction/order identifiers and payment details. A signed URL is not inherently a person's identity, but its access material should be removed from shared logs.
- User-owned content: free-text messages, mail subjects/bodies, recordings/transcripts, screenshots/OCR, clipboard contents, documents, notes, todo titles, trip information, vacation requests, search terms and selected media/browser history. Public song titles become private usage information when logged as the user's selections. For downloader diagnosis, the `media` profile preserves YouTube source video references by default so the failing source remains reproducible; `--redact-media-ids` opts into hiding those selections too. Do not mistake a public artist/uploader for the customer's name.
- Files and URLs: alias custom folder segments and personal file stems while retaining extensions, separators and hierarchy. Preserve aliases for the same source/target folder and file. Alias private/custom hosts, resource identifiers, signed parameters, fragments and nontechnical query values. Preserve known public service hosts, safe route constants, ports, schemes, status and format information. Review query allowlists against the actual product, rather than assuming that an unknown parameter is harmless.
- Correlation and timing: alias session/request/trace/user/device identifiers, including hashed identifiers that still track a person. Preserve equality within the batch. Keep real technical event and expiry times by default. If `--shift-timestamps` is selected, shift both together and preserve durations and relative validity. Separately alias personal dates and precise locations.

The script handles labeled values, common formats, nested JSON and JSON stored inside strings. Unlabeled names, local-format phone numbers, natural-language addresses, raw binary content and arbitrary pasted messages require contextual review. Partially masked values such as purchase-ID tails can still correlate a user; replace the remaining value rather than retaining the suffix.

## Preserve the failure evidence

Keep log level, scope, event names, startup/shutdown markers, version/build/platform, locale/language, exception class, symbolic and HTTP error codes, retry state, queue/progress counters, sizes, speeds, durations, timeout values, MIME/codec/format, ports, protocol, relevant flags and stack-frame source filenames/line numbers. Keep object/array structure and item counts when practicable. Never truncate entire logs or discard failing records simply to remove one private field.

For folder/move problems, retain:

- Source and target drives, separators, hierarchy and different root-folder aliases.
- The same album-folder alias and file alias at every repeated occurrence.
- File extensions and errors such as `ENOENT`, `EACCES` and `ENOTDIR`.
- Conversion/move/stat transitions, queue totals and durations.

If path length, spaces, Unicode, punctuation or casing causes the failure, add safe diagnostic facts about those properties alongside the alias. An alias changes the original spelling and length; do not infer that the original had the placeholder's characters or length. Likewise retain safe structural facts about malformed user input without reproducing its text.

For networking, retain repeated-host equality, IP class, port, method, safe endpoint route, response code, connection state, reconnect/retry events and request correlations. For mail/authentication/purchases, retain protocol outcome, product/SKU identifiers that are public constants, error code, payload length and entitlement state while hiding the credential, customer and payload itself.

For downloader failures, retain the source video reference under the selected media-ID policy, format IDs/codecs, relevant HTTP header names and nonsecret technical values, downloader options, retry counts and URL expiry. Process a full URL or a hostless `videoplayback?...` query parameter by parameter. For example, `sig=private&itag=251&dur=42` must preserve `itag=251&dur=42`; replacing the whole tail hides evidence. Repeated access values receive equal aliases; changed signatures or sessions remain distinguishable. Matching video IDs in source URLs and metadata must stay correlated. Do not preserve signed access values themselves.

Keep version/channel/build strings such as `nightly@2026.10.08.235100` verbatim; an `@` alone does not establish an email address. Verify both privacy and diagnostic properties. Synthetic regression fixtures should cover successful and failed retries, changes in signed URL parameters, expiry before/after an event, and actual email/token removal alongside preserved versions.

Aliases are generated by first occurrence and exist only in process memory. They are not unsalted hashes or partial original values. A sharing recipient can follow relations without receiving the mapping. Separate runs may use different aliases, so process related files together.

## Local extension rules

Use `--rules "C:/private/redaction-rules.json"` to add confirmed field and prose rules. This file can contain private literal values, so keep it local and do not commit or share it. Contextual regexes must use a named `value` capture and stop before the next field/record. Example with synthetic data:

```json
{
  "fields": {
    "customCustomerReference": "PERSON_ID",
    "customMessageBody": "CONTENT"
  },
  "patterns": [
    {"category": "PERSON", "pattern": "Recipient name: (?P<value>[^\\r\\n,]+)"},
    {"category": "PERSON", "pattern": "(?P<value>Alice Example)"}
  ]
}
```

Use existing categories where possible. Scalar leaf replacement preserves JSON container formatting; numeric identifying values become strings. Custom regex rules should target the smallest confirmed private span. Do not apply broad patterns to `message`, `name`, `id`, `code`, `key`, `path` or a complete HTTP payload without checking its context. Redact credentials fully even when their last characters would help correlation.

## Verify and report

Review every kind of record in the file, not merely the first matching line. Search for contact, credential, device, purchase, location, payload, path and URL fields, long strings, copied notes and new product-specific data structures. Never print raw match snippets in progress messages or validation reports. A zero `--check` result means known rules found nothing further; contextual review remains required.

Verify against the source without changing it: encoding/BOM/newlines, record ordering, parseability, repeated-value relations, error codes, stack line numbers and the concrete failure scenario. When complete redaction of a personal payload removes text needed to explain a failure, preserve a synthetic structural description or safe technical metadata separately; do not restore the private text.
