const sharp = require("sharp");
const fs = require("fs");

async function raster(svgPath, outPath, size) {
  let svg = fs.readFileSync(svgPath, "utf8");
  svg = svg.replace(/aria-label="[^"]*"/, 'aria-label="Menu al Dia"');
  // Ensure XML encoding declaration for non-ascii leftovers
  if (!svg.includes("encoding=")) {
    svg = svg.replace(
      "<svg ",
      '<?xml version="1.0" encoding="UTF-8"?>\n<svg ',
    );
  }
  await sharp(Buffer.from(svg, "utf8")).resize(size, size).png().toFile(outPath);
  console.log("wrote", outPath, fs.statSync(outPath).size);
}

(async () => {
  await raster(
    "public/brand/menualdia-icon.svg",
    "public/brand/menualdia-icon-192.png",
    192,
  );
  await raster(
    "public/brand/menualdia-icon.svg",
    "public/brand/menualdia-icon-512.png",
    512,
  );
  await raster(
    "public/brand/menualdia-mark.svg",
    "public/brand/menualdia-mark-512.png",
    512,
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
