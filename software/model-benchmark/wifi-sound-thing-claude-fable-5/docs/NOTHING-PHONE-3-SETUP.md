# Solution for a Nothing Phone (3) with wireless headphones

*Written 2026-07-08. Sources at the bottom.*

## What the Nothing Phone (3) can and can't do

- Runs **Nothing OS 3.5 / Android 15**, **Bluetooth 6.0** hardware — so it's a fully capable
  Android host for **this app** (Android 10+ is all we need).
- **Auracast / Bluetooth LE Audio broadcast is NOT enabled** on the Phone (3) as of early
  2026. The radio is capable, but Nothing hasn't shipped the broadcast feature in software
  (there are open community requests for it). → the "phone broadcasts to many headphones"
  route is unavailable today.
- **No "Dual Audio"** feature in Nothing OS (unlike Samsung). Nothing's dual-connection is
  headphones pairing to two *sources*, the opposite of what we want.

**Conclusion:** the built-in one-source-to-two-headphones tricks don't exist on this phone
right now. But your goal is still achievable. Pick the route that matches your situation.

---

## Route 1 (recommended): this app — works today, no extra hardware

This is exactly what the app is for, and the Nothing Phone (3) is a perfectly good host.
The trick is **which device the wireless headphones connect to.**

**Two-person setup (the common case):**

- **Person A holds the Nothing Phone (3)** and connects **their** Bluetooth headphones to it
  the normal way (one standard Bluetooth link — no special feature needed). They hear the
  audio directly.
- The Nothing Phone (3) also runs **this app in Host mode** and starts broadcasting. Capture
  is non-exclusive, so the phone keeps playing to Person A's headphones *and* streams a copy
  over Wi-Fi at the same time.
- **Person B** installs this app, opens **Client** mode on **their own phone**, and connects
  **their** Bluetooth headphones to **that** phone. They tap the Nothing Phone (3) when it
  appears (or type its address).

Result: both people are on wireless headphones, from one Nothing Phone (3), today, for free.

**More listeners:** each additional listener just needs a phone running Client mode + their
own wireless headphones. No limit from the app side.

**The one requirement to be aware of:** in this route, each *listener* needs **a phone** to
receive the stream — the wireless headphones connect to that phone, not directly to the
Nothing Phone (3). If everyone listening has a phone (the normal case for two friends), this
is the cleanest answer.

**Latency note:** Person A (headphones straight on the Nothing Phone (3)) is perfectly in
sync with anything shown on that phone. Person B is slightly behind — our network + buffer
(~0.1–0.25 s) *plus* Person B's own Bluetooth headphone delay on top. For music and for
watching a video *on the host phone* together this is normally comfortable; pick the
**"Lowest delay"** buffering preset in the client if you want to minimise it.

## Route 2: headphones connected *directly* to the Nothing Phone (3), no second phone

If a listener has **no phone** and their wireless headphones must talk **directly** to the
Nothing Phone (3) (so: two Bluetooth headphones, both on the one phone), the app can't help —
that needs a broadcast/dual-sink feature the phone doesn't expose. Your only route today is a
small piece of hardware:

- **A USB-C Bluetooth "dual-link" transmitter.** Plug it into the Nothing Phone (3)'s USB-C
  port (the Phone (3) has **no headphone jack**, so get a **USB-C** model, not a 3.5 mm one),
  put it in transmitter mode, and pair **two** Bluetooth headphones to it.
- ✅ Works with **any** audio on the phone, needs no app, and because it taps the phone's own
  audio output it also gets around the DRM-capture limit (see `DRM-CAPTURE-FAQ.md`).
- ❌ It's an extra ~€20–40 gadget to buy and carry, and most such dongles cap at **two**
  headphones. Check the product explicitly says **"two devices / dual link"** and is
  **USB-C**; look for **low-latency (aptX LL / FastStream)** if you'll watch video.

## Route 3: wait for Auracast (future, not now)

If Nothing enables **Auracast** on the Phone (3) in a future Nothing OS update, then a single
broadcast to unlimited **Auracast-capable** headphones becomes possible with no app and no
dongle — the ideal end state. But it needs (a) Nothing to ship it and (b) the *headphones* to
support Auracast too (plain "Bluetooth 5.3 / LE Audio" on the box is not enough — it must say
Auracast). Not something to count on today. Note: Nothing's own **Ear (3)** / **Headphone
(1)** would also need to be confirmed Auracast *receivers* for this to work end to end.

---

## Recommendation for your case

- **If the other listener(s) have a phone:** use **Route 1** — it already does exactly what
  you want with the Nothing Phone (3) and any wireless headphones, for free, today. The neat
  part is Person A can wear headphones straight on the Nothing Phone (3) while Person B
  listens through the app on their phone.
- **If a listener has only headphones and no phone:** get a **USB-C dual-link Bluetooth
  transmitter** (Route 2). It's the only thing that drives two wireless headphones straight
  off the Nothing Phone (3) today.
- **Don't wait for Auracast** unless you specifically want the no-hardware future path and are
  willing to depend on a Nothing OS update plus Auracast-certified headphones.

## Sources

- [Nothing Community — request to enable Bluetooth LE Audio Broadcast (Auracast) on Nothing phones](https://nothing.community/d/39756-enable-bluetooth-le-audio-broadcast-auracast-for-multi-device-audio-accessibility)
- [Nothing Community — "When does Nothing support Bluetooth LE audio?"](https://nothing.community/d/36218-when-does-nothing-support-bluetooth-le-audio)
- [TechRadar — Nothing Phone (3) review (Nothing OS 3.5 / Android 15)](https://www.techradar.com/phones/nothing-phones/nothing-phone-3-review)
- [Bluetooth SIG — Auracast FAQ (BT 5.2+ / Public Broadcast Profile requirement)](https://www.bluetooth.com/auracast/faq/)
