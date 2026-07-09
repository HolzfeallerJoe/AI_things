# Can we use something other than Wi-Fi to stream sound to two devices?

*Research + recommendation, written 2026-07-08. Sources listed at the bottom.*

## The question, made precise

Today the app streams the host's audio over **Wi-Fi/LAN to other phones running the app**.
You asked whether we could use a *different* connection so we can "stream any sound to two
devices — phone, headphones, or whatever else."

The crucial word is **headphones**. There are really two different goals hiding in the
question, and they have very different answers:

- **Goal A — receivers are phones** (each person's phone, which then drives their own
  headphones). This is what the app does now.
- **Goal B — receivers are the headphones themselves** (no phone in the middle), so a plain
  pair of earbuds hears the host directly.

Goal B is the interesting one, and it's exactly the classic "one phone, two Bluetooth
headphones" problem. Below is the honest landscape.

## Why plain Bluetooth can't just do it

Classic Bluetooth music (the **A2DP** profile) is **point-to-point: one source → one sink.**
The protocol has no concept of a second headphone. That single fact is the reason this
whole problem exists and the reason "just use Bluetooth" isn't a drop-in answer. Everything
below is a way *around* that limitation.

## The realistic options

### 1. Vendor "Dual Audio" (Samsung Dual Audio, and similar)

Some phones (notably Samsung) can pair **two** A2DP headphones at once as an OS feature.

- ✅ Works with any audio the phone plays, receivers are ordinary headphones, no app needed.
- ❌ **Two devices max**, only on phones that ship the feature (not a standard Android
  capability), often only on the same brand's/newer devices, and it adds latency and can
  hurt battery. Most importantly for us: it is an **OS setting, not something an app can
  turn on** — there is no public Android API for us to invoke it. We can't build on it.

### 2. Bluetooth LE Audio + Auracast — the "proper" modern answer

**Auracast** (part of Bluetooth LE Audio) is a genuine **broadcast**: one transmitter sends
one stream that **unlimited** receivers can tune into, like a private radio station, using
the efficient **LC3** codec at low latency and no pairing. This is *the* technology designed
for precisely what you're describing.

- ✅ One-to-many by design (2, 5, 20 receivers), low latency, good quality, receivers are
  just headphones tuning in.
- ❌ **Needs LE Audio / Auracast hardware on *both* ends** — the broadcasting phone *and*
  every pair of headphones. In 2026 that means fairly new flagships only: Pixel 8 and newer
  (not the 8a/9a), Galaxy S23 and newer, a handful of Xiaomi/POCO models — and headphones
  that explicitly say "Auracast" (Bluetooth 5.3 / "LE Audio" on the box is **not** enough).
- ❌ **iPhones can neither broadcast nor receive** as of early 2026.
- ❌ Real-world support is still uneven: discovery isn't always smooth, and several OEMs
  shipped the Android 13/14 APIs without a working underlying stack ("register the callback,
  call start… and silence"). It becomes reasonably usable around Android 16 / One UI 7.
- ⚠️ **The developer catch for us:** the Android APIs that exist (`BluetoothLeBroadcast`,
  `BluetoothLeBroadcastAssistant`) are largely about *steering receivers* to a broadcast and
  are driven by the system "Audio Sharing" UI. There is **no clean, universally supported
  public API for a third-party app to capture arbitrary media audio and push it into an
  Auracast broadcast** — and even if there were, it would only run on that short list of
  flagship phones. So Auracast is **not something we can bolt onto this app** as a portable
  software transport today. It's better thought of as a *native OS feature* users with the
  right hardware can use *instead of* our app.

### 3. Hardware Bluetooth dual-transmitter (the pragmatic "works today" answer)

A small **Bluetooth transmitter dongle** that plugs into the host's headphone jack or USB-C
and pairs with **two** headphones at once (many support dual-link; some are Auracast).

- ✅ Works with **any** host (even iPhones, TVs), **any** audio source, and — because it
  taps the analog/USB output — it even sidesteps the DRM capture problem from the other FAQ.
- ❌ It's **extra hardware to buy and carry**, usually 2 headphones, and it's not software we
  can ship. But it's cheap and reliable, and worth recommending in the README.

### 4. Wired headphone splitter

A passive 3.5 mm Y-splitter into two wired headphones.

- ✅ Zero latency, zero cost, works with literally anything with a jack.
- ❌ Tethered, wired only, and many modern phones have no jack (needs a USB-C DAC first).

### 5. Wi-Fi Direct / hotspot (a variation on what we already do)

Still fundamentally "our app over IP," but **without needing a router** — the host makes a
peer-to-peer/hotspot network the clients join.

- ✅ Removes the "must be on the same router" limitation; useful on the go.
- ❌ Receivers are **still phones running the app**, so it's Goal A, not Goal B. It's an
  incremental improvement to our existing transport, not a new capability.

### 6. FM transmitter / others

Broadcasting on an FM frequency to any FM radio earbud works and is truly one-to-many, but
quality is poor, it needs FM-receiver hardware, and it's legally restricted in many
countries. Not worth pursuing.

## Summary table

| Option | Receivers can be bare headphones? | >2 receivers | Works with any host audio | Something *our app* can do in software | Free / no new HW |
|---|---|---|---|---|---|
| Our Wi-Fi app (today) | ❌ (phones) | ✅ | ✅ (non-DRM) | ✅ | ✅ |
| Vendor Dual Audio | ✅ | ❌ (2) | ✅ | ❌ (OS-only) | ✅ |
| Auracast / LE Audio | ✅ | ✅ | ⚠️ via OS sharing | ❌ (no portable API, flagship-only) | ✅ if you own the HW |
| BT dual-transmitter | ✅ | usually 2 | ✅ (+ beats DRM) | ❌ (hardware) | ❌ |
| Wired splitter | ✅ | 2 | ✅ | ❌ (hardware) | ❌ |
| Wi-Fi Direct | ❌ (phones) | ✅ | ✅ | ✅ | ✅ |

## My opinion / recommendation

**Bluetooth is not a software replacement for our Wi-Fi transport, and we should not try to
make it one.** The reasons are structural, not effort-related:

1. Plain A2DP is one-sink by specification — a dead end for "two devices."
2. Auracast is the *right* standard and genuinely one-to-many, but it requires specific new
   hardware on both ends, only lands on a few flagships, excludes iPhones, and — decisively —
   offers **no portable public API for an app to broadcast captured audio.** We'd be building
   on sand that only exists on a handful of 2024+ phones.
3. Vendor Dual Audio and hardware transmitters solve Goal B, but neither is something an app
   can drive — they're an OS toggle and a physical dongle respectively.

So the two goals split cleanly:

- **If receivers should be phones (Goal A):** our Wi-Fi/IP approach is already the most
  universal, free, works-on-any-phone-today answer, and it's the *only* one of these that
  can also capture streaming apps. The sensible enhancement here is **adding a Wi-Fi Direct /
  hotspot mode** so no shared router is required — modest effort, real benefit, keeps every
  NFR intact.
- **If receivers should be bare headphones (Goal B):** the right guidance is **not to
  reimplement it in our app** but to point users at what already does it well:
  **Auracast** if they have the hardware, **their phone's Dual Audio** setting if it has one,
  or a **cheap Bluetooth dual-transmitter** for any host (which also defeats the DRM issue).
  I'd add a short "Listening on headphones directly" section to the README saying exactly
  this.

In one line: **keep Wi-Fi as the engine (it's the only free, universal, capture-anything
option), consider Wi-Fi Direct as a nice-to-have, and treat Bluetooth/Auracast as an
external OS/hardware feature we recommend rather than something we build.**

## Sources

- [Google — LE Audio Auracast support expands to more Android devices](https://blog.google/products-and-platforms/platforms/android/le-audio-auracast-support/)
- [Bluetooth SIG — Auracast](https://www.bluetooth.com/auracast/) and [Auracast for Developers](https://www.bluetooth.com/auracast/developers/)
- [Venucast — Auracast Reality Check 2026](https://venucast.com/blogs/news/auracast-reality-check-2026-does-bluetooth-auracast-actually-work-with-real-devices-today)
- [Medium — Auracast on Android 16: the BLE Audio shift devs are building wrong](https://bleadvertiserapp.medium.com/auracast-on-android-16-the-ble-audio-shift-devs-are-building-wrong-fc30bd8a057e)
- [droidcon — Building an Auracast assistant app](https://www.droidcon.com/2024/09/03/bluetooth-le-audio-broadcast-how-to-build-an-auracast-assistant-app-with-flutter/)
- [Android Authority — Samsung Dual Audio](https://www.androidauthority.com/samsung-dual-audio-how-to-1137101/)
- [Google Pixel Help — Use multiple Bluetooth audio accessories at once](https://support.google.com/pixelphone/answer/16483797?hl=en)
- [Samsung — Broadcast audio from your Galaxy phone](https://www.samsung.com/us/support/answer/ANS10001042/)
