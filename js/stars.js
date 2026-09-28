/* Nearby star systems: Sol plus the 99 nearest systems (roughly everything
 * inside ~26 light-years, plus Vega and Fomalhaut for landmarks).
 *
 * Each entry: [name, RA (decimal hours, J2000), Dec (decimal degrees, J2000),
 *              distance from Sol (light-years), spectral type of primary,
 *              components, note]
 *
 * Positions are converted at load time into galactic Cartesian coordinates:
 *   +X toward the galactic centre, +Y along galactic rotation, +Z toward the
 *   north galactic pole. Units are light-years.
 */
const RAW_STARS = [
  ["Sol", 0, 0, 0, "G2V", [], "Home system. Origin of the map."],
  ["Proxima Centauri", 14.4954, -62.6795, 4.24, "M5.5V", [], "Nearest star to Sol. Outer member of the Alpha Centauri system; hosts Proxima b."],
  ["Alpha Centauri", 14.6600, -60.8339, 4.37, "G2V", ["A · G2V", "B · K1V"], "Closest Sun-like binary. Rigil Kentaurus and Toliman."],
  ["Barnard's Star", 17.9634, 4.6933, 5.96, "M4V", [], "Highest proper motion of any star."],
  ["Luhman 16", 10.8219, -53.3194, 6.50, "L7.5", ["A · L7.5", "B · T0.5"], "Closest brown dwarf pair."],
  ["WISE 0855-0714", 8.9197, -7.2453, 7.27, "Y4", [], "Coldest known brown dwarf, near 250 K."],
  ["Wolf 359", 10.9414, 7.0147, 7.86, "M6V", [], "Faint flare star."],
  ["Lalande 21185", 11.0553, 35.9700, 8.31, "M2V", [], "Brightest red dwarf in the northern sky. Hosts two known planets."],
  ["Sirius", 6.7525, -16.7161, 8.66, "A1V", ["A · A1V", "B · DA2 white dwarf"], "Brightest star in Earth's night sky."],
  ["Luyten 726-8", 1.6503, -17.9503, 8.73, "M5.5V", ["A · M5.5V (BL Ceti)", "B · M6V (UV Ceti)"], "UV Ceti is the prototype flare star."],
  ["Ross 154", 18.8303, -23.8361, 9.69, "M3.5V", [], "Flare star in Sagittarius."],
  ["Ross 248", 23.6986, 44.1750, 10.30, "M5.5V", [], "Voyager 2 passes within 1.7 ly in ~40,000 years."],
  ["Epsilon Eridani", 3.5489, -9.4583, 10.48, "K2V", [], "Young Sun-like star with a debris disk and a giant planet."],
  ["Lacaille 9352", 23.0978, -35.8531, 10.72, "M0.5V", [], "Bright red dwarf hosting at least two super-Earths."],
  ["Ross 128", 11.7956, 0.8044, 11.01, "M4V", [], "Quiet red dwarf with a temperate planet, Ross 128 b."],
  ["WISE 1506+7027", 15.1139, 70.4600, 11.10, "T6", [], "Isolated T-type brown dwarf."],
  ["EZ Aquarii", 22.6425, -15.3019, 11.11, "M5V", ["A · M5V", "B · M5.5V", "C · M6V"], "Triple red dwarf system."],
  ["61 Cygni", 21.1150, 38.7494, 11.40, "K5V", ["A · K5V", "B · K7V"], "First star to have its distance measured by parallax."],
  ["Procyon", 7.6550, 5.2250, 11.46, "F5IV-V", ["A · F5IV-V", "B · DQZ white dwarf"], "Eighth-brightest star in the night sky."],
  ["Struve 2398", 18.7131, 59.6303, 11.52, "M3V", ["A · M3V", "B · M3.5V"], "Binary red dwarf in Draco."],
  ["Groombridge 34", 0.3064, 44.0231, 11.62, "M1.5V", ["A · M1.5V", "B · M3.5V"], "Wide binary; A hosts a super-Earth."],
  ["DX Cancri", 8.4969, 26.7769, 11.68, "M6.5V", [], "Very faint flare star."],
  ["Epsilon Indi", 22.0561, -56.7861, 11.87, "K5V", ["A · K5V", "Ba · T1", "Bb · T6"], "Orange dwarf with a binary brown dwarf companion and a Jovian planet."],
  ["Tau Ceti", 1.7344, -15.9375, 11.91, "G8V", [], "Closest single Sun-like star. Several candidate planets."],
  ["GJ 1061", 3.5997, -44.5125, 11.98, "M5.5V", [], "Hosts three terrestrial planets."],
  ["YZ Ceti", 1.2086, -16.9989, 12.11, "M4.5V", [], "Three small inner planets."],
  ["Luyten's Star", 7.4567, 5.2258, 12.35, "M3.5V", [], "Hosts the temperate super-Earth GJ 273b. Only 1.2 ly from Procyon."],
  ["Teegarden's Star", 2.8836, 16.8814, 12.50, "M7V", [], "Ultra-cool dwarf with two temperate planets."],
  ["Kapteyn's Star", 5.1947, -45.0183, 12.83, "M1V", [], "Halo star on a retrograde galactic orbit."],
  ["Lacaille 8760", 21.2875, -38.8675, 12.95, "M0V", [], "AX Microscopii. One of the brightest red dwarfs."],
  ["SCR 1845-6357", 18.7508, -63.9644, 13.05, "M8.5V", ["A · M8.5V", "B · T6"], "Late M dwarf with a brown dwarf companion."],
  ["Kruger 60", 22.4664, 57.6958, 13.07, "M3V", ["A · M3V", "B · M4V flare star"], "Close binary in Cepheus."],
  ["DEN 1048-3956", 10.8042, -39.9350, 13.17, "M8.5V", [], "Ultra-cool dwarf in Antlia."],
  ["UGPS 0722-05", 7.3742, -5.6750, 13.40, "T9", [], "Very cold T-type brown dwarf."],
  ["Ross 614", 6.4897, -2.8139, 13.35, "M4.5V", ["A · M4.5V", "B · M8V"], "Flare-star binary in Monoceros."],
  ["Wolf 1061", 16.5050, -12.6625, 14.05, "M3.5V", [], "Three planets, one in the habitable zone."],
  ["Van Maanen's Star", 0.8194, 5.3886, 14.07, "DZ7", [], "Closest solitary white dwarf."],
  ["Gliese 1", 0.0900, -37.3575, 14.17, "M1.5V", [], "Bright red dwarf in Sculptor."],
  ["Wolf 424", 12.5547, 9.0208, 14.31, "M5V", ["A · M5V", "B · M7V"], "Close binary flare stars."],
  ["TZ Arietis", 2.0036, 13.0522, 14.51, "M4.5V", [], "Flare star with a gas-giant planet."],
  ["Gliese 687", 17.6072, 68.3392, 14.77, "M3V", [], "Hosts a Neptune-mass planet."],
  ["LHS 292", 10.8036, -11.3356, 14.80, "M6.5V", [], "Faint flare star in Sextans."],
  ["Gliese 674", 17.4778, -46.8953, 14.81, "M3V", [], "Hosts a hot Neptune."],
  ["GJ 1245", 19.8983, 44.4153, 14.81, "M5.5V", ["A · M5.5V", "B · M6V", "C · M8V"], "Triple system of faint flare stars."],
  ["Gliese 440", 11.7619, -64.8414, 15.12, "DQ6", [], "White dwarf in Musca."],
  ["Gliese 876", 22.8881, -14.2636, 15.25, "M4V", [], "Four planets in a resonant chain."],
  ["LHS 288", 10.7392, -61.2100, 15.77, "M5.5V", [], "Luyten 143-23."],
  ["GJ 1002", 0.1122, -7.5394, 15.81, "M5.5V", [], "Two Earth-mass planets in the habitable zone."],
  ["Gliese 412", 11.0914, 43.5267, 15.83, "M1V", ["A · M1V", "B · M5.5V (WX UMa)"], "Wide binary in Ursa Major."],
  ["Groombridge 1618", 10.1894, 49.4542, 15.88, "K7V", [], "Active orange dwarf."],
  ["AD Leonis", 10.3267, 19.8700, 16.06, "M3V", [], "Very active flare star."],
  ["Gliese 832", 21.5594, -49.0089, 16.13, "M1.5V", [], "Hosts a Jupiter-like planet."],
  ["Gliese 682", 17.6175, -44.3192, 16.34, "M4V", [], "Faint red dwarf in Scorpius."],
  ["40 Eridani", 4.2544, -7.6528, 16.33, "K0.5V", ["A · K0.5V", "B · DA4 white dwarf", "C · M4.5V"], "Keid. Triple system; B is the easiest white dwarf to observe."],
  ["GJ 1005", 0.2578, -16.1339, 16.32, "M4V", ["A · M4V", "B · M4V"], "Close binary in Cetus."],
  ["EV Lacertae", 22.7806, 44.3339, 16.48, "M3.5V", [], "Powerful flare star."],
  ["70 Ophiuchi", 18.0908, 2.5000, 16.59, "K0V", ["A · K0V", "B · K4V"], "Classic visual binary."],
  ["Altair", 19.8464, 8.8683, 16.73, "A7V", [], "Rapidly rotating A star; vertex of the Summer Triangle."],
  ["GJ 3379", 6.0011, 2.7067, 17.00, "M3.5V", [], "Red dwarf in Orion."],
  ["Gliese 445", 11.7947, 78.6911, 17.14, "M3.5V", [], "Voyager 1 passes within 1.6 ly in ~40,000 years."],
  ["LHS 1723", 5.0325, -6.9461, 17.50, "M4V", [], "GJ 3323. Two planets."],
  ["WISE 0350-5658", 3.8333, -56.9750, 17.60, "Y1", [], "Y-type brown dwarf."],
  ["GJ 1116", 8.9708, 19.7631, 17.60, "M5.5V", ["A · M5.5V", "B · M5.5V"], "EI Cancri. Binary flare star."],
  ["Gliese 526", 13.7622, 14.8914, 17.72, "M1.5V", [], "Wolf 498."],
  ["Stein 2051", 4.5197, 58.9769, 18.05, "M4V", ["A · M4V", "B · DC5 white dwarf"], "Red dwarf and white dwarf pair."],
  ["Gliese 251", 6.9136, 33.2681, 18.20, "M3V", [], "Wolf 294. Hosts a super-Earth."],
  ["Gliese 205", 5.5242, -3.6772, 18.60, "M1.5V", [], "Wolf 1453. Bright red dwarf."],
  ["Sigma Draconis", 19.5394, 69.6611, 18.80, "K0V", [], "Alsafi. Stable orange dwarf."],
  ["Gliese 229", 6.1764, -21.8647, 18.80, "M1V", ["A · M1V", "B · T7"], "B was the first confirmed T dwarf."],
  ["Ross 47", 5.7025, 12.4892, 18.90, "M4V", [], "Gliese 213."],
  ["Gliese 693", 17.7764, -57.3189, 19.00, "M3V", [], "Red dwarf in Ara."],
  ["Gliese 570", 14.9578, -21.4156, 19.20, "K4V", ["A · K4V", "B · M1V", "C · M3V", "D · T7"], "Quadruple system with a T dwarf."],
  ["Wolf 1055", 19.2819, 5.1689, 19.30, "M3V", ["A · M3V", "B · M8V (VB 10)"], "VB 10 is a benchmark ultra-cool dwarf."],
  ["Gliese 754", 19.3467, -45.5583, 19.30, "M4.5V", [], "Red dwarf in Telescopium."],
  ["Gliese 908", 23.8203, 2.4011, 19.30, "M1V", [], "BR Piscium."],
  ["Gliese 588", 15.5369, -41.2756, 19.30, "M2.5V", [], "Red dwarf in Lupus."],
  ["Eta Cassiopeiae", 0.8183, 57.8153, 19.40, "G3V", ["A · G3V", "B · K7V"], "Achird. Sun-like star with an orange companion."],
  ["36 Ophiuchi", 17.2558, -26.6028, 19.50, "K2V", ["A · K2V", "B · K1V", "C · K5V"], "Triple orange-dwarf system."],
  ["HR 7703", 20.1867, -36.1011, 19.60, "K3V", ["A · K3V", "B · M3.5V"], "Gliese 783."],
  ["82 Eridani", 3.3322, -43.0697, 19.70, "G8V", [], "Metal-poor Sun-like star with several super-Earths."],
  ["QY Aurigae", 7.1672, 38.5294, 19.70, "M4.5V", ["A · M4.5V", "B · M5V"], "Gliese 268. Binary flare star."],
  ["Delta Pavonis", 20.1456, -66.1819, 19.90, "G8IV", [], "Sun-like subgiant, a classic SETI target."],
  ["Gliese 784", 20.2314, -45.1639, 20.30, "M0V", [], "Bright red dwarf in Telescopium."],
  ["Gliese 300", 8.2114, -21.5519, 20.40, "M3.5V", [], "Red dwarf in Puppis."],
  ["HN Librae", 14.5714, -12.5194, 20.40, "M4V", [], "Gliese 555."],
  ["Gliese 581", 15.3239, -7.7222, 20.50, "M3V", [], "Famous planetary system with three confirmed planets."],
  ["LP 944-20", 3.6597, -35.4289, 21.00, "M9V", [], "Very low-mass star / brown dwarf boundary object."],
  ["Gliese 625", 16.4233, 54.3042, 21.10, "M1.5V", [], "Hosts a super-Earth."],
  ["HR 8832", 23.2214, 57.1683, 21.30, "K3V", [], "Gliese 892. Multi-planet system."],
  ["Xi Boötis", 14.8564, 19.1006, 22.00, "G8V", ["A · G8V", "B · K4V"], "Bright binary in Boötes."],
  ["LTT 1445", 3.0308, -16.5933, 22.40, "M3V", ["A · M3V", "B · M3.5V", "C · M4V"], "Triple system; A hosts transiting rocky planets."],
  ["Gliese 880", 22.9431, 16.5533, 22.40, "M1.5V", [], "Red dwarf in Pegasus."],
  ["Gliese 402", 10.8478, 6.8081, 22.70, "M4V", [], "Wolf 358."],
  ["Gliese 809", 20.8889, 62.1544, 23.20, "M0.5V", [], "Red dwarf in Cepheus."],
  ["Gliese 667", 17.3158, -34.9897, 23.60, "K3V", ["A · K3V", "B · K5V", "C · M1.5V"], "C hosts the super-Earth GJ 667 Cc."],
  ["Beta Hydri", 0.4292, -77.2542, 24.30, "G2IV", [], "Bright Sun-like subgiant near the south celestial pole."],
  ["Mu Cassiopeiae", 1.1378, 54.9203, 24.60, "G5V", ["A · G5V", "B · M5V"], "Marfak. High-velocity halo binary."],
  ["Vega", 18.6156, 38.7836, 25.00, "A0V", [], "Fifth-brightest star; former and future pole star."],
  ["Fomalhaut", 22.9608, -29.6222, 25.10, "A3V", ["A · A3V", "B · K4V", "C · M4V"], "Bright A star with a spectacular debris ring."],
  ["Pi3 Orionis", 4.8306, 6.9614, 26.30, "F6V", [], "Tabit. Bright F-type star in Orion."],
];

/* ---- spectral styling -------------------------------------------------- */
const SPECTRAL_COLORS = {
  O: "#9bb0ff", B: "#aabfff", A: "#f0f3ff", F: "#fff4e8", G: "#fff2a8",
  K: "#ffd2a1", M: "#ff9e6b", L: "#d07050", T: "#a06cd8", Y: "#6a4bb5", D: "#dfe9ff",
};
const SPECTRAL_RADII = { O: 6, B: 5.5, A: 5, F: 4.5, G: 4, K: 3.4, M: 2.7, L: 2.2, T: 2, Y: 2, D: 2.3 };
const SPECTRAL_NAMES = {
  O: "Blue star", B: "Blue-white star", A: "White star", F: "Yellow-white star",
  G: "Yellow dwarf", K: "Orange dwarf", M: "Red dwarf",
};
const FAMOUS = new Set([
  "Proxima Centauri", "Barnard's Star", "Wolf 359", "Lalande 21185", "Luyten's Star",
  "Teegarden's Star", "Kapteyn's Star", "Ross 128", "Gliese 581", "Gliese 876",
  "Van Maanen's Star", "Luhman 16", "Ross 248", "Lacaille 9352", "Ross 154",
]);

function classify(spec) {
  const letter = spec[0];
  if (letter === "D") return "White dwarf";
  if ("LTY".includes(letter)) return "Brown dwarf";
  let name = SPECTRAL_NAMES[letter] || "Star";
  if (/IV(?!-)/.test(spec)) name = name.replace(/dwarf|star/, "subgiant");
  return name;
}

/* J2000 equatorial (RA hours, Dec degrees, distance) -> galactic Cartesian */
function equatorialToGalactic(raHours, decDeg, dist) {
  const d2r = Math.PI / 180;
  const ra = raHours * 15 * d2r, dec = decDeg * d2r;
  const raG = 192.85948 * d2r, decG = 27.12825 * d2r, lNCP = 122.93192 * d2r;
  const sinB = Math.sin(dec) * Math.sin(decG) + Math.cos(dec) * Math.cos(decG) * Math.cos(ra - raG);
  const b = Math.asin(sinB);
  const y = Math.cos(dec) * Math.sin(ra - raG);
  const x = Math.sin(dec) * Math.cos(decG) - Math.cos(dec) * Math.sin(decG) * Math.cos(ra - raG);
  const l = lNCP - Math.atan2(y, x);
  return {
    x: dist * Math.cos(b) * Math.cos(l),
    y: dist * Math.cos(b) * Math.sin(l),
    z: dist * sinB,
  };
}

const STARS = RAW_STARS.map(([name, ra, dec, dist, spec, comps, note]) => {
  const letter = spec[0];
  const pos = dist === 0 ? { x: 0, y: 0, z: 0 } : equatorialToGalactic(ra, dec, dist);
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    name, ra, dec, dist, spec, note,
    comps: comps.length ? comps : [spec],
    cls: classify(spec),
    color: SPECTRAL_COLORS[letter] || "#ffffff",
    r: SPECTRAL_RADII[letter] || 3,
    major: "OBAFGK".includes(letter) || FAMOUS.has(name),
    x: pos.x, y: pos.y, z: pos.z,
  };
});
