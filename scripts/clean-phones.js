// clean-phones.js
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

// ── НАСТРОЙКИ ────────────────────────────────────────────────────────────────
// Формат вывода: по твоему примеру делаем 3-3-3 (пример: 317-100-222).
// Если нужно 3-3-4 (пример: 317-430-5190), поменяй на [3, 3, 4].
const GROUPING = [3, 3, 4];

// Какие строки игнорить полностью (по твоей фразе "игнориуй test:dummy")
const IGNORE_RE = /test\s*:\s*dummy|test\s*lead:\s*dummy/i;

// Валидный regex для текущего формата (пересобирается из GROUPING)
const VALID_RE = new RegExp(
  '^' + GROUPING.map(n => `\\d{${n}}`).join('-') + '$'
);

// Номера, которые считаем мусорными и ставим NULL
const HARD_REJECT = [
  '000000000', '0000000000', '111111111', '1111111111', '222222222', '999999999',
  '123123123', '1231231231', '123456789', '888888888', '8888888888',
];

// Если строка содержит такой паттерн цифр подряд — тоже NULL
const REPEATED_DIGIT_RE = /^(\d)\1{8,}$/; // 9+ одинаковых цифр подряд

// Если true — только покажет, что бы обновили (без записи в БД)
const DRY_RUN = false;
dotenv.config()
// ── ПОДКЛЮЧЕНИЕ К БАЗЕ ───────────────────────────────────────────────────────
const db = await mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
});


// ── УТИЛИТЫ ──────────────────────────────────────────────────────────────────
function onlyDigits(s) {
  return (s ?? '').replace(/\D/g, '');
}

function isHardRejectDigits(digits) {
  if (!digits) return true;
  if (HARD_REJECT.includes(digits)) return true;
  if (REPEATED_DIGIT_RE.test(digits)) return true;
  return false;
}

function formatByGrouping(digits, grouping = GROUPING) {
  let pos = 0;
  const parts = [];
  for (const n of grouping) {
    parts.push(digits.slice(pos, pos + n));
    pos += n;
  }
  return parts.join('-');
}

/**
 * Нормализация:
 * - выкидываем всё, кроме цифр
 * - если 11 цифр и начинается с 1 — срезаем ведущую 1
 * - приводим к длине sum(GROUPING):
 *     > если длиннее — отрезаем хвост (по твоему примеру: 3171002222 -> 317-100-222)
 *     > если короче — считаем невалидным (вернём null)
 * - форматируем по GROUPING
 * - мусор/повторы — null
 */
function cleanPhone(raw) {
  if (!raw || IGNORE_RE.test(raw)) return null; // игнор/пусто -> не обновляем

  let d = onlyDigits(raw);

  // Срезаем ведущую "1" (часто бывает как +1)
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);

  const targetLen = GROUPING.reduce((a, b) => a + b, 0);

  if (d.length > targetLen) d = d.slice(0, targetLen);
  if (d.length < targetLen) return null;

  if (isHardRejectDigits(d)) return null;

  return formatByGrouping(d);
}

// ── ОСНОВНОЕ ─────────────────────────────────────────────────────────────────
async function main() {
  const [rows] = await db.query(
    'SELECT id, phone FROM customers WHERE phone IS NOT NULL'
  );

  const updates = [];

  for (const row of rows) {
    const id = row.id;
    const phone = String(row.phone ?? '').trim();

    // пропускаем явные "test:dummy"
    if (IGNORE_RE.test(phone)) continue;

    if (VALID_RE.test(phone)) {
      // уже валиден — пропускаем
      continue;
    }

    const cleaned = cleanPhone(phone);

    // Если после чистки валиден — обновим; если null — занулим (по смыслу "плохие" → NULL)
    const nextVal = cleaned && VALID_RE.test(cleaned) ? cleaned : null;

    if (nextVal === phone) continue; // нечего менять

    updates.push({ id, before: phone, after: nextVal });
  }

  // Вывод для проверки
  console.log(`Найдено к обновлению: ${updates.length}`);
  for (const u of updates.slice(0, 50)) {
    console.log(`#${u.id}: "${u.before}"  →  ${u.after === null ? 'NULL' : `"${u.after}"`}`);
  }
  if (updates.length > 50) {
    console.log(`... и ещё ${updates.length - 50}`);
  }

  if (DRY_RUN) {
    console.log('DRY_RUN=true — изменения не записывались.');
    process.exit(0);
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const stmt = await conn.prepare('UPDATE customers SET phone = ? WHERE id = ?');

    for (const u of updates) {
      await stmt.execute([u.after, u.id]); // null запишется как NULL
    }

    await stmt.close();
    await conn.commit();
    console.log('Обновления применены.');
  } catch (e) {
    await conn.rollback();
    console.error('Ошибка, откат транзакции:', e);
  } finally {
    conn.release();
    db.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
