import bcrypt from 'bcryptjs'

const args = process.argv.slice(2)

if (args.length === 0) {
  // biome-ignore lint/suspicious/noConsole: we need to see
  console.error('Usage: node hash-password.js <password>')
  process.exit(1)
}

const password = args[0]

;(async () => {
  try {
    const passwordHash = await bcrypt.hash(password, 10)
    // biome-ignore lint/suspicious/noConsole: we need to see
    console.log(passwordHash)
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: we need to see
    console.error('Error hashing password:', error)
    process.exit(1)
  }
})()
