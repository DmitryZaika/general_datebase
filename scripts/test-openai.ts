import OpenAI from 'openai';

const key = (process.env.OPEN_AI_SECRET_KEY || '').trim();
const openai = new OpenAI({
  apiKey: key,
});

async function test() {
  try {
    console.log('Testing OpenAI connection with model: gpt-4o-mini');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say hello' }],
    });
    console.log('Success!', completion.choices[0].message.content);
  } catch (error) {
    console.error('OpenAI Test Failed:', error);
  }
}

test();
