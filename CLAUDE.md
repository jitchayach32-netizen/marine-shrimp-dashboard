# ระบบติดตามข้อมูลการเพาะเลี้ยงกุ้งทะเล

Web app สรุป/dashboard ข้อมูลการเลี้ยงกุ้งทะเลรายจังหวัด/รายภาค (2565–มิ.ย.2569) สำหรับผู้บริหารระดับกรม/กระทรวง ข้อมูลดึงสดจาก Google Sheet ที่มีคนอื่นดูแลอยู่แล้ว อัพเดทอัตโนมัติทุก 15 นาที

## วิธีรัน

ดับเบิลคลิก `start.bat` แล้วเปิด browser ไปที่ `http://localhost:3000`

**ไม่มีระบบ login/สิทธิ์ผู้ใช้** — ทุกคนที่เข้าเว็บนี้ได้เห็นและ export ข้อมูลได้เต็มที่เหมือนกันหมด (ตัดออกตามคำขอผู้ใช้ในรอบแก้ไขที่สอง)

## สถาปัตยกรรม

- **Backend**: Node.js + Express, ไม่มี native dependency ที่ต้อง compile (ใช้ `node:sqlite` built-in ของ Node ≥22.5 แทน better-sqlite3 เพราะเครื่อง dev ไม่มี Python/build tools)
- **DB**: SQLite ไฟล์เดียว (`data/app.db`) เป็น cache ชั่วคราวเหนือ Google Sheet ที่เป็น source of truth จริง
- **Sync**: `server/sync/` ดึง CSV จาก Google Sheets ผ่าน `gviz/tq` endpoint (ต้องตั้ง sheet เป็น "Anyone with the link: Viewer"), sync ตอน server start + ทุก 15 นาที + ปุ่ม manual sync ในหน้า admin
- **Repository pattern**: `server/data/repository.js` เป็น interface กลาง, `sqliteRepository.js` implement ในเฟสนี้ — เฟส 2 (Firebase) แค่เพิ่ม `firestoreRepository.js` แล้วสลับใน `server/data/index.js` โดยไม่แตะ routes/frontend
- **Frontend**: Multi-page vanilla HTML/CSS/JS ไม่มี framework, ใช้ Chart.js (vendor เข้ามาเป็นไฟล์ local ไม่พึ่ง CDN)
- **Export**: CSV (built-in), Excel (exceljs), Table PDF + Form PDF (pdfmake + ฟอนต์ Tahoma ที่ vendor มาจาก Windows Fonts เพื่อรองรับภาษาไทย) — export ได้ทุกแบบโดยไม่มีข้อจำกัด

## ข้อมูลต้นทาง

Google Sheet ID: `1ACT5En5oeWWJXkyb0i7PjduBAxMnRtmW` (8 แท็บ, ดู gid ทั้งหมดใน `server/sync/sheetsClient.js`)

หมายเหตุสำคัญเกี่ยวกับข้อมูล:
- ปีในชีท 1-7 เป็น พ.ศ. 2 หลัก (65=2565), ชีท 8 (ราคา) เป็น ค.ศ. 2 หลัก (22=2022) — คนละมาตรฐานปี ระวังเวลาต่อยอด
- ชีท 4 (production_incoming) เริ่มข้อมูลจาก Jan 2567 ไม่ใช่ 2565 เหมือนชีทอื่น
- คอลัมน์คู่ในชีท 1-5 หมายถึง กุ้งขาวแวนนาไม (หลัก) / กุ้งกุลาดำ (รอง)
- ชีท 5 (กำลังการผลิต) มีค่าผิดปกติ (>20 ตัน/ล้านตัว) ที่ระบบจะ**แสดงจริงพร้อม badge เตือน** ไม่ตัดทิ้ง — ดู `is_anomaly` column
- บาง cell ในไฟล์ต้นฉบับมี encoding เสียหาย (mojibake) ที่ชื่อจังหวัด — parser มี fuzzy-match แก้ให้แล้ว (`resolveProvinceId` ใน `server/sync/parsers.js`)
- ชีท 8 (ราคา) ไม่มีมิติจังหวัด เป็นราคาตลาดกลางเดียว (ตลาดทะเลไทย จ.สมุทรสาคร)

## Checklist ความคืบหน้า

- [x] Scaffold โปรเจกต์ (package.json, start.bat)
- [x] DB schema + seed จังหวัด/ภาค (36 จังหวัด, 6 ภาค)
- [x] Sheets sync module — ทดสอบ sync จริงครบ 8 ชีท (28,911 rows, unmatched provinces = 0)
- [x] Repository layer (interface พร้อม Firebase เฟส 2)
- [x] REST API routes ครบทุกชีท + compare + admin (เปิดเข้าถึงได้ทุกคน ไม่มี auth)
- [x] Export CSV/Excel/Table PDF/Form PDF (ทดสอบ PDF ภาษาไทยแสดงผลถูกต้อง, ไม่มีข้อจำกัดสิทธิ์)
- [x] Shared frontend (theme.css ตาม dataviz palette, navbar.js, api.js, charts.js)
- [x] หน้า dashboard ภาพรวม (เป็นหน้าแรก, root `/` redirect มาที่นี่)
- [x] หน้าข้อมูลรายชีท 8 หน้า (seed-distribution, seed-stocking, production-farm, production-incoming, production-capacity, documents-seed, documents-meat, prices)
- [x] หน้า compare (เลือกผสม metric/sheet × จังหวัด/ภาค × เวลาได้อิสระ)
- [x] หน้า admin (sync log + manual sync trigger เท่านั้น — ไม่มี user management แล้ว)
- [x] ทดสอบ end-to-end ผ่าน start.bat จริง (ทุกหน้าโหลดสำเร็จ, ทุก API endpoint เข้าถึงได้โดยไม่ login, export ทุกแบบทำงานได้เต็มที่)

### รอบแก้ไขที่ 2: ตัดระบบ login/สิทธิ์ผู้ใช้ออกทั้งหมด

ผู้ใช้ตัดสินใจว่าไม่ต้องการแยกสิทธิ์ 3 ระดับอีกต่อไป (เดิมคือ admin/เจ้าหน้าที่กรม/ผู้บริหาร) — ทุกคนที่เข้าเว็บเห็นและ export ได้เท่ากันหมด สิ่งที่ถูกลบออก:
- `server/auth/` (session.js), `server/routes/auth.js`, `public/index.html` (หน้า login)
- `users` table ออกจาก schema.sql
- `requireAuth`/`requirePermission` middleware ออกจากทุก route (data, export, admin)
- Navbar ตัดส่วนแสดงชื่อผู้ใช้/role badge/ปุ่ม logout ออก
- `admin.html` ตัด user management UI ออก เหลือแค่ sync log + manual sync
- `bcryptjs`, `cookie-session` ออกจาก dependencies
- เพิ่ม root route (`GET /`) redirect ไป `/dashboard.html` เพราะไม่มี login page ให้เป็นหน้าแรกแล้ว

### รอบแก้ไขที่ 3: ปรับหน้า dashboard ให้ครอบคลุมแบบ infographic กรมประมง

ผู้ใช้ส่ง infographic ตัวอย่าง ("สถานการณ์กุ้งทะเลของประเทศไทย") ให้เทียบว่าระบบมีข้อมูลรองรับแค่ไหน — สำรวจแล้วพบว่า 8 ชีทที่ sync อยู่รองรับได้ 7/9 ส่วน ยกเว้น **การส่งออก-นำเข้าระหว่างประเทศที่ไม่มีข้อมูลอยู่ในระบบเลย** (ไม่มีมิติประเทศคู่ค้า/ปริมาณ-มูลค่าการค้าระหว่างประเทศในทั้ง 8 ชีท) — วางเป็น placeholder card ไว้ก่อน

**สิ่งสำคัญที่ต้องจำไว้เพื่อไม่ให้สับสน**: ชีท `production_incoming` (ผลผลิตขาเข้า) หมายถึงกุ้งที่เข้าสู่โรงงาน/ผู้รับซื้อ**ภายในประเทศ** ไม่ใช่การนำเข้าจากต่างประเทศ ห้ามเอาไปแทนข้อมูล "การนำเข้า" ระดับประเทศ

Dashboard ใหม่มี (บนลงล่าง): stat-grid 6 tiles พร้อม %YoY → การ์ดผลผลิต+ลงลูกพันธุ์แยกชนิด (ขาว|กุลาดำ) → การ์ดแนวโน้มราคา (กราฟ+ตาราง YoY แยกขนาด) → การ์ด placeholder ส่งออก/นำเข้า → แผนที่+ตารางภาค (เดิม) → การ์ด Top 5 จังหวัดผู้ผลิตหลักแยกชนิด

- ไม่แตะ backend เลย — ทุกอย่างคำนวณที่ frontend จาก endpoint เดิม (`/api/data/monthly/:sheetType`, `/api/data/prices`) ยิง 2 คำขอ (ปีปัจจุบัน + ปีก่อนหน้า) แล้วคำนวณ %YoY เอง ผ่านฟังก์ชัน `fetchWithYoY()` ใน `dashboard.html`
- ปีแรกที่มีข้อมูล (2565) จะไม่มีปีก่อนให้เทียบ — `computeYoY()` คืน `null` และ UI แสดง "ไม่มีข้อมูลปีก่อนเทียบ" แทนการหารด้วยศูนย์/error
- ราคาใช้ปี ค.ศ. ต่างจากชีทอื่นที่ใช้ พ.ศ. — แปลงด้วย `yearBEtoCE()` ก่อนยิง `/api/data/prices` เสมอ
- เพิ่ม CSS class ใหม่ใน `theme.css`: `.two-col-grid` (การ์ดคู่ responsive), `.metric-split*` (แสดงคู่ขาว/กุลาดำ), `.rank-table` (Top 5), `.placeholder-card`/`.badge-pending` (ส่วนที่ยังไม่มีข้อมูล)

## สิ่งที่ยังไม่ได้ทำ (นอกเฟส 1)

- **เฟส 2**: เชื่อม Firebase Firestore จริง + auto-fallback เป็น localStorage เมื่อ offline
- **เฟส 3**: Deploy ขึ้น Firebase Hosting / production จริง

## รู้ไว้ก่อนแก้โค้ดต่อ

- Sheet sharing ต้องเป็น "Anyone with the link: Viewer" เสมอ ไม่งั้น sync job จะดึงข้อมูลไม่ได้ (WebFetch/https ปกติเข้าไม่ถึง Sheet ที่ private)
- `start.bat` ต้องเป็นภาษาอังกฤษล้วน — เคยลองใส่ข้อความไทยแล้ว cmd.exe (ตัว shell เอง ไม่ใช่ node) parse ผิดจนบางบรรทัดกลายเป็นคำสั่งประหลาด แม้จะใส่ `chcp 65001` แล้วก็ยังพัง เพราะ batch file ถูก parse ทั้งไฟล์ก่อนรันด้วย codepage เดิม ข้อความภาษาไทยจาก Node.js เองไม่มีปัญหานี้เพราะเขียน stdout ตรงเป็น UTF-8
- `node:sqlite` ไม่ใช่ `better-sqlite3` — API คล้ายกันมากแต่ไม่มี `.pragma()` method (ใช้ `exec('PRAGMA ...')` แทน) และไม่มี `.transaction()` helper (ใช้ `BEGIN`/`COMMIT`/`ROLLBACK` เอง)
