# Dual Bluetooth transmitter for the Nothing Phone (3) — products, how it works, caveats

*Written 2026-07-08. Sources at the bottom. Prices/links change constantly and web search
here is US-biased — treat product names as the reliable part and check your local
Amazon/marketplace for current price and the exact connector.*

## The single most important point (answers "can the phone even do this?")

**You do NOT connect two Bluetooth headphones at the phone's software layer — and that's
exactly why this works.**

With a hardware transmitter, the **phone sees only ONE audio output**: the dongle. All the
"talk to two headphones at once" logic lives **inside the transmitter's own chip**, invisible
to Android. So the Nothing Phone (3)'s missing features (no Dual Audio, no Auracast) simply
**don't matter** — you're bypassing the phone's Bluetooth stack entirely:

```
Nothing Phone (3)  ──(one wired/USB audio link)──►  Transmitter  ──BT──►  Headphone A
                       phone thinks: "a headset"      (does the         └─BT──►  Headphone B
                                                        splitting)
```

The phone just plays audio to what looks like a normal headset. The dongle receives that one
stream and re-broadcasts it to two Bluetooth headphones. No phone-side multi-Bluetooth
support required.

## Two physically different transmitter types (this matters for a Nothing Phone 3)

The Phone (3) has **USB-C only, no 3.5 mm jack.** That splits your options:

### Type A — analog-input transmitter + a USB-C DAC (most reliable on a phone)

These take a **3.5 mm analog** input and broadcast to two headphones. Because the Phone (3)
has no jack, you add a cheap **USB-C → 3.5 mm adapter (DAC)** in front:

```
Phone USB-C ─► USB-C-to-3.5mm DAC ─► short 3.5mm cable ─► AirFly-style box ─► 2 headphones
```

- ✅ **Most likely to "just work"** — Android's USB-C headphone-adapter audio output is
  universal and rock-solid, and the transmitter never has to be compatible with the phone
  (it only sees an analog wire). Battery-powered, so it doesn't drain the phone much.
- ❌ A small chain of two adapters to carry.
- **Products:** *Twelve South AirFly Duo* / *AirFly Pro 2* (very popular, aptX Low Latency,
  ~20 h battery), *Avantree Relay* / *SoundJet R2* (Qualcomm, aptX Adaptive), *Avantree
  Priva* series, *MEE audio Connect*. All explicitly stream to **two** headphones.

### Type B — USB-C digital transmitter (one cable, but compatibility is hit-or-miss on phones)

These plug **straight into USB-C** and present as a USB audio device. Designed for
**PS5 / Switch / PC**.

- ✅ One clean cable, no analog step.
- ❌ **Reliability on Android phones is inconsistent.** They're built for consoles; some
  enumerate fine as a USB-Audio-Class headset on Android and route audio, others are ignored
  by the phone or lock to a console sample rate. Vendors frequently list them as
  "for PC/console," and some Avantree USB models are documented as **not** for phones. If you
  go this way, buy somewhere with easy returns and **verify it says phone/Android**.
- **Products:** *Avantree C81* (USB-C, dual-link, PS5/PC/Switch), *HomeSpot USB-C aptX LL*
  (dual stream). Both advertise two headphones.

## How do the two *wireless* headphones connect to it?

Wireless headphones are the normal, intended case — there is no wire to the headphones. **The
only wire is phone → transmitter.** The transmitter acts like a "mini phone": your two
Bluetooth headphones **pair to the transmitter** over Bluetooth, just as they'd pair to a
phone.

```
Nothing Phone (3) ──USB-C wire──► Transmitter ))) Bluetooth ))) Headphone A (wireless)
                                              ))) Bluetooth ))) Headphone B (wireless)
```

Pairing procedure (general — all dual-link transmitters follow this shape; exact buttons are
on the quick-start card):

1. Put the **transmitter in pairing mode** (usually hold its button until the LED flashes).
2. Put **Headphone A in pairing mode** — it connects to the transmitter.
3. Trigger the transmitter's **"add a second device"** step (a second press/hold that makes it
   search again).
4. Put **Headphone B in pairing mode** — it connects too.
5. Both now play simultaneously; after the first time they normally reconnect automatically.

Example specifics: on the *AirFly Duo* you hold the button to pair the first headphone, then
hold again to add the second; *Avantree* models have an equivalent "multi-pair" step in the
manual. The headphones always connect to the **transmitter**, never to the phone.

## What to look for when buying

- **Explicitly "two headphones / dual-link / dual-stream."** Most transmitters do only one.
- **The right connector for the Phone (3):** either Type A (any + a USB-C DAC) or a Type B
  that clearly states **USB-C *and* Android/phone** support.
- **Low latency for video:** aptX Low Latency (~40 ms) or aptX Adaptive. Plain SBC adds
  ~150–200 ms → noticeable lip-sync lag. **Both** headphones (and the transmitter) must
  support the low-latency codec or it drops back to SBC. Mismatched-brand headphones often
  fall back to SBC — worth knowing.
- **Battery vs bus-powered:** Type A boxes have their own battery; Type B draw from the phone.

## Latency / quality reality

Even at best this adds a Bluetooth hop's delay. aptX LL keeps it low enough for video;
SBC does not. Two *different* headphone models may run different codecs, so one person can be
slightly behind the other. For music none of this matters; for watching video together, aim
for two headphones that both support the **same** low-latency codec as the transmitter.

## Experiences — Nothing Phone (3) specifically

I could **not find first-hand reports of anyone using a dual Bluetooth transmitter with a
Nothing Phone (3)** — it's a niche combination and the phone is recent. What I can say
honestly:

- The method is **phone-agnostic by design** (it rides on standard USB-C audio-out or a
  USB-C DAC, both of which the Phone (3) supports), so there's no Nothing-specific blocker
  for **Type A**.
- General Android experience with **Type B** USB-C console transmitters is **mixed**, and I
  have no Phone-(3)-specific confirmation — so don't assume; buy returnable.
- The Nothing community itself is still **asking Nothing to add Auracast/LE Audio broadcast**
  (not yet shipped), which is why the hardware route is currently the only direct-to-phone
  answer. If/when Nothing enables Auracast, a transmitter becomes unnecessary.

## Shopping list with links

Links are mostly Amazon US and prices/stock change — search the same product names on your
local marketplace (e.g. **Amazon.de**) and confirm the listing says **"2 headphones /
dual-link"** and the right connector.

**Type A (recommended) — needs both parts, because the Phone (3) has no 3.5 mm jack:**

1. USB-C → 3.5 mm DAC adapter (into the phone):
   - [ELIK USB-C to 3.5 mm adapter with DAC (Android)](https://www.amazon.com/ELIK-USB-Headphone-Compatible-Essential/dp/B07RFCV4HF)
   - [Google USB-C to 3.5 mm adapter](https://www.amazon.com/Google-Headphone-Adapter-Type-C-Phones/dp/B07J28BYT9)
2. Dual Bluetooth transmitter (3.5 mm input → two headphones):
   - [Twelve South AirFly Duo](https://us.amazon.com/Twelve-South-Transmitter-Headphones-Airplanes/dp/B07Z13H4TP)
   - [Twelve South AirFly Pro 2](https://www.twelvesouth.com/products/airfly-pro-2)
   - [Avantree Relay](https://www.amazon.com/Avantree-Relay-Headphones-Transmitter-Flight/dp/B0C3QQ4X6F)
   - [Avantree SoundJet R2](https://www.amazon.com/Avantree-SoundJet-Bluetooth-Headphones-Transmitter/dp/B0CQ2C6DFX) (Avantree lists it discontinued; stock varies)
   - [MEE audio Connect](https://meeaudio.com/products/connect)

**Type B (one USB-C cable, but confirm Android/phone support and buy returnable):**

- [Avantree C81 (USB-C dual-link)](https://www.aliexpress.com/s/wiki-ssr/article/avantree-c81-usb-c-bluetooth-transmitter-dual-link-two-headphones)
- [HomeSpot USB-C aptX LL dual transmitter](https://www.amazon.com/HomeSpot-Bluetooth-Transmitter-Compatible-Headphones/dp/B088R1HDZW)

## Honest bottom line

- **Safest bet for the Phone (3): Type A** — an *AirFly Duo* (or *Avantree Relay*) **plus a
  USB-C-to-3.5 mm DAC**. Highest chance of working the day it arrives, with two headphones,
  low latency if the codecs match.
- **Tidier but riskier: Type B** USB-C dual transmitter (*Avantree C81*) — only if the
  listing clearly confirms phone/Android use, and buy where you can return it.
- **Remember the free alternative:** if the second listener has a **phone**, you don't need
  any of this — this app already does it (Nothing Phone (3) as Host, their phone as Client
  with their own Bluetooth headphones). See `NOTHING-PHONE-3-SETUP.md`, Route 1.

## Sources

- [Twelve South AirFly Duo (2 headphones, aptX LL)](https://us.amazon.com/Twelve-South-Transmitter-Headphones-Airplanes/dp/B07Z13H4TP) and [AirFly Pro 2](https://www.twelvesouth.com/products/airfly-pro-2)
- [Avantree Relay — airplane adapter for 2 headphones, aptX Adaptive](https://www.amazon.com/Avantree-Relay-Headphones-Transmitter-Flight/dp/B0C3QQ4X6F)
- [Avantree — how to connect two headphones at the same time](https://avantree.com/knowledge-base/general-connect-with-two-devices-at-the-same-time/)
- [Avantree C81 USB-C dual-link transmitter (PS5/PC)](https://www.aliexpress.com/s/wiki-ssr/article/avantree-c81-usb-c-bluetooth-transmitter-dual-link-two-headphones)
- [HomeSpot USB-C aptX LL dual transmitter](https://www.amazon.com/HomeSpot-Bluetooth-Transmitter-Compatible-Headphones/dp/B088R1HDZW)
- [MEE audio Connect — dual Bluetooth transmitter](https://meeaudio.com/products/connect)
- [Nothing Community — request to enable Auracast/LE Audio broadcast](https://nothing.community/d/39756-enable-bluetooth-le-audio-broadcast-auracast-for-multi-device-audio-accessibility)
