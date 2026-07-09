# Transmitter research notes — findings not captured in the other docs

*Compiled 2026-07-08. These are the conclusions from the follow-up research (dual Bluetooth
transmitters for a Nothing Phone (3) + wireless headphones) that aren't already in
`BLUETOOTH-TRANSMITTER-GUIDE.md`, `NOTHING-PHONE-3-SETUP.md`, `TRANSPORT-OPTIONS.md` or
`DRM-CAPTURE-FAQ.md`. Context: the user has a **Nothing Phone (3)** and a **UGREEN USB-C→3.5 mm
DAC adapter already**, and wants two **wireless** headphones fed from the one phone.*

## 1. The big one: two headphones almost always means a codec/latency downgrade

This is the most important undocumented finding and it changes the buying advice.

- Connecting **two** headphones to a dual-link transmitter **splits the Bluetooth bandwidth**.
  That typically **adds ~20–30 ms latency** and, on most units, forces the codec to **fall
  back to SBC** — because there isn't enough bandwidth to run two aptX-Low-Latency streams at
  once.
- This is a **general rule, not specific to any one brand.** TROND states outright that with
  two headphones it drops from aptX LL to SBC; the same pattern holds across the budget/mid
  class.
- It is **not universal** — a few *higher-end* units are explicitly documented to hold aptX LL
  with two headphones:
  - **Avantree Audikast Plus** — "maintains 40 ms with two aptX-LL headphones"
  - **Avantree DG80** — two headphones on aptX LL, or four on SBC
- Regardless of the transmitter, **both headphones must themselves support aptX LL** or it
  falls back anyway. Many earbuds — and **all AirPods** (AAC only) — don't support aptX at
  all, so with those, low latency is off the table no matter which transmitter you buy.

**Practical consequence:**
- **Music:** SBC / added latency is inaudible → any dual transmitter is fine.
- **Video (lip-sync):** budget dual transmitters will likely lag with two headphones. Only
  the specific "dual aptX-LL" units above are safe, *and* both headphones must support aptX LL.
- This is why, for **watching video together**, the app route (each viewer on their own phone)
  or a future Auracast setup sidesteps the whole codec problem — the transmitter path is
  genuinely weak for two-headphone video sync.

## 2. The user's existing UGREEN USB-C→3.5 mm DAC covers the "part 1" stage

- The Nothing Phone (3) has **no headphone jack**, so an analog (3.5 mm-input) transmitter
  needs a USB-C DAC in front. The user **already owns a UGREEN USB-C→3.5 mm adapter**, so no
  second DAC purchase is needed — only the transmitter.
- Confirmation it's the right kind: because it already plays wired headphones on the Phone (3)
  (which has no analog passthrough), it must contain a real DAC. Good.
- Still needed: a **3.5 mm male-to-male cable** between the UGREEN adapter's 3.5 mm socket and
  the transmitter's 3.5 mm input — unless the transmitter ships with one (AirFly/Avantree
  usually do; check the box).

## 3. Assessment of the specific "UGREEN Bluetooth 5.2 Transmitter, 2-in-1, for Two AirPods"

(Amazon.de ASIN **B0CJY56XG3**.)

- ✅ Good fit on paper: two headphones, 3.5 mm input (works with the user's UGREEN DAC), same
  brand, aptX LL advertised, ~12 h battery, portable, budget price tier.
- ⚠️ **UGREEN does not document** anywhere (checked their India/EU/US product pages) that aptX
  LL is **retained when two headphones are connected.** Given finding #1, assume it behaves
  like the class: **SBC / higher latency in dual mode.**
- **Verdict:** a good, well-matched **budget pick for music**. **Not** a safe pick if the goal
  is two-headphone **video** sync.

## 4. Budget (~€20) tier options and their trade-off

- The AirFly Duo / Avantree Relay tier is ~€40–60. The ~€20 tier is value brands: **YMOO**,
  **1Mii**, TROND-style units.
- Same caveat as #1, more so: at this price, two-headphone mode is essentially always SBC.
  Fine for music, laggy for video.
- Amazon.de candidates seen (real listings from the store's index; prices unverified — see #6):
  - YMOO Bluetooth 5.3 pocket adapter — ASIN **B0B84NDTZB**
  - 1Mii B06TX (TV-box style) — ASIN **B0838YPSZT**

## 5. Link verification status (Amazon.de, German market)

Verified as the *right product* by ASIN match to pages that loaded; note the caveat in #6.

| Product | Amazon.de ASIN | Two headphones | Notes |
|---|---|---|---|
| Twelve South AirFly Duo | B07Z13H4TP | ✅ | title confirms "to 2 Wireless Headphones" |
| Twelve South AirFly Pro (DE) | B0B1NRSRM3 | ✅ | up to 2 headphones |
| Avantree Relay | B0C3QQ4X6F | ✅ | BT 5.3, aptX Adaptive |
| UGREEN 5.2 2-in-1 | B0CJY56XG3 | ✅ | see #3; dual-mode codec undocumented |
| YMOO 5.3 pocket | B0B84NDTZB | ✅ | budget, ~€20 tier |
| 1Mii B06TX | B0838YPSZT | ✅ | budget, TV-box style |
| Avantree Audikast Plus | (search by name) | ✅ | **keeps aptX LL with 2** — best for video |
| Avantree DG80 | (search by name) | ✅ | **2× aptX LL / 4× SBC** — best for video |

Guaranteed-to-resolve search URLs (use if a deep link is stale):
`https://www.amazon.de/s?k=<product+name>`.

## 6. Honest limits of this research

- **I could not load Amazon pages through my tools** (Amazon resets/blocks the fetch — US and
  DE alike). The Amazon.de links come from Amazon's own search index and their **ASINs match
  the US product pages I *was* able to load**, so the product identity is reliable — but I
  **did not confirm live price or stock**, and could not confirm the €20 figure (it's "typical
  for the type," not verified).
- The non-Amazon technical claims (codec/latency behavior) were confirmed on UGREEN's own
  sites, Avantree's support docs, Monoprice, and forums — those pages did load.

## 7. Net recommendation for this specific setup

1. **Mostly music →** buy the **UGREEN 5.2 (B0CJY56XG3)** or a YMOO; feed it from the UGREEN
   USB-C DAC with a 3.5 mm male-to-male cable. Cheapest, matches existing gear.
2. **Two-headphone video sync matters →** buy an **Avantree Audikast Plus** or **DG80**
   (documented dual aptX LL), and make sure **both** headphones support aptX LL.
3. **Best sync overall, no new hardware →** if the other listener has a phone, use this app
   (Nothing Phone (3) = Host, their phone = Client + their own Bluetooth headphones); the
   transmitter codec problem doesn't apply. See `NOTHING-PHONE-3-SETUP.md` Route 1.

## Sources

- [Avantree — Different Bluetooth Codecs / Latency](https://support.avantree.com/hc/en-us/articles/31257100736793-Different-Bluetooth-Codecs-Latency)
- [Avantree Audikast Plus (keeps aptX LL with two headphones)](https://avantree.com/audikast-plus-bluetooth-5.0-transmitter-for-tv)
- [Monoprice BT 5 transmitter (codec list)](https://www.monoprice.com/product?p_id=43243)
- [UGREEN 70158 transmitter/receiver product page](https://www.ugreenindia.com/products/ugreen-bluetooth-5-0-aptx-transmitter-receiver-optical-3-5mm-aux-low-latency-adapter-for-tv-av-receiver-audio-system-with-dual-link-charge-play-70158)
