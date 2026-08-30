/**
 * מייצר את קובצי הלוגו של המערכת מתוך קובץ המקור של המשרד (`לוגו.jpg`).
 *
 *   npx tsx scripts/build-logo.ts [קובץ מקור]
 *
 * הסקריפט חותך את השוליים הלבנים ומייצר:
 *   public/logo.png      - הלוגו המלא
 *   public/monogram.png  - המונוגרמה בלבד (משמשת כאייקון הדפדפן)
 *
 * הרקע נשאר לבן במכוון: הלוגו מוצג תמיד על משטח לבן במערכת, בדיוק כמו
 * על הניירת של המשרד. כך נשמרים הצבעים המקוריים במדויק, כולל הזהב.
 *
 * אם יתקבל קובץ לוגו מעודכן - יש להחליף את קובץ המקור ולהריץ שוב.
 */
import sharp from "sharp";
import path from "node:path";

const SOURCE = process.argv[2] ?? "לוגו.jpg";
const OUT = "public";

async function main() {
  const src = path.resolve(process.cwd(), SOURCE);
  const meta = await sharp(src).metadata();
  console.log(`מקור: ${SOURCE} (${meta.width}x${meta.height})`);

  // חיתוך השוליים הלבנים סביב הלוגו
  const trimmed = await sharp(src).trim({ threshold: 15 }).toBuffer();
  const t = await sharp(trimmed).metadata();
  console.log(`אחרי חיתוך שוליים: ${t.width}x${t.height}`);

  await sharp(trimmed)
    .resize({ width: 900, withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/logo.png`);

  // המונוגרמה נמצאת בחלק השמאלי, עד לקו המפריד הזהוב
  const monoWidth = Math.round(t.width! * 0.38);
  await sharp(trimmed)
    .extract({ left: 0, top: 0, width: monoWidth, height: t.height! })
    .trim({ threshold: 15 })
    .resize({
      width: 256,
      height: 256,
      fit: "contain",
      background: { r: 255, g: 255, b: 255 },
    })
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/monogram.png`);

  for (const f of ["logo.png", "monogram.png"]) {
    const m = await sharp(`${OUT}/${f}`).metadata();
    console.log(`  ${f}: ${m.width}x${m.height}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
