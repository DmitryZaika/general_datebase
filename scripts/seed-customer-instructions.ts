import mysql from 'mysql2/promise';

const access = {
  user: process.env.DB_USER,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
};

async function seed() {
  const db = await mysql.createConnection(access);
  const companyId = 1; // Granite Depot of Indianapolis
  const isPublic = 1; // Customer/Employee instructions

  console.log('Seeding customer instructions...');

  try {
    // 1. Advising Customers on Granite Selection
    const [res1] = await db.execute(
      'INSERT INTO instructions (title, parent_id, after_id, rich_text, company_id, public) VALUES (?, ?, ?, ?, ?, ?)',
      [
        'Advising Customers on Granite Selection',
        null,
        null,
        '<p>When advising customers, always emphasize that granite is a natural stone and every slab is unique. Encourage them to view the actual slabs that will be used for their project at the warehouse.</p>',
        companyId,
        isPublic
      ]
    );
    const id1 = (res1 as any).insertId;

    // 2. Understanding Patterns and Movement (parent: id1)
    const [res2] = await db.execute(
      'INSERT INTO instructions (title, parent_id, after_id, rich_text, company_id, public) VALUES (?, ?, ?, ?, ?, ?)',
      [
        'Understanding Patterns and Movement',
        id1,
        null,
        '<p>Help customers understand the difference between consistent patterns and "movement" (veining). Large-veined granites make a dramatic statement but may require more thoughtful seam placement.</p>',
        companyId,
        isPublic
      ]
    );
    const id2 = (res2 as any).insertId;

    // 3. Finish Options: Polished vs. Leathered (parent: id1, after: id2)
    const [res3] = await db.execute(
      'INSERT INTO instructions (title, parent_id, after_id, rich_text, company_id, public) VALUES (?, ?, ?, ?, ?, ?)',
      [
        'Finish Options: Polished vs. Leathered',
        id1,
        id2,
        '<p>Explain the tactile and visual differences between finishes. <strong>Polished</strong> is classic and reflective, while <strong>Leathered</strong> provides a textured, matte look that is excellent for hiding fingerprints and water spots.</p>',
        companyId,
        isPublic
      ]
    );

    // 4. Durability and Maintenance Education (after: id1)
    await db.execute(
      'INSERT INTO instructions (title, parent_id, after_id, rich_text, company_id, public) VALUES (?, ?, ?, ?, ?, ?)',
      [
        'Durability and Maintenance Education',
        null,
        id1,
        '<p>Educate customers on granite maintenance. While highly durable and heat-resistant, it is a porous material that should be professionally sealed. Advise them on using pH-neutral cleaners to preserve the sealer and stone surface.</p>',
        companyId,
        isPublic
      ]
    );

    console.log('Successfully seeded customer instructions.');
  } catch (error) {
    console.error('Error seeding instructions:', error);
  } finally {
    await db.end();
  }
}

seed();
