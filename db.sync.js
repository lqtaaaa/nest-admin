const { exec } = require('node:child_process')
const mysql = require('mysql2/promise')

async function waitForDatabase() {
  const config = {
    host: process.env.DB_HOST || 'mysql',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_DATABASE || 'nest_admin',
  }

  let retries = 30
  while (retries > 0) {
    try {
      const connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
      })

      // 检查数据库是否存在
      const [rows] = await connection.execute(
        `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = '${config.database}'`,
      )

      if (rows.length === 0) {
        console.log(`Database ${config.database} does not exist, creating...`)
        await connection.execute(`CREATE DATABASE IF NOT EXISTS ${config.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`)
        console.log(`Database ${config.database} created successfully`)
      }
      else {
        console.log(`Database ${config.database} already exists`)
      }

      await connection.end()
      return true
    }
    catch (err) {
      console.log(`Unable to connect to database: ${err.message}, retrying in 1 second...`)
      retries--
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  throw new Error('Unable to connect to database after multiple attempts')
}

async function main() {
  try {
    console.log('Waiting for database to be ready...')
    await waitForDatabase()
    console.log('Database is ready, starting application...')

    // 启动应用
    const pm2Process = exec('pm2-runtime ecosystem.config.js')
    pm2Process.stdout.pipe(process.stdout)
    pm2Process.stderr.pipe(process.stderr)

    // 处理退出信号
    process.on('SIGINT', () => {
      console.log('Caught interrupt signal, cleaning up...')
      pm2Process.kill()
      process.exit()
    })
  }
  catch (error) {
    console.error('Failed to start application:', error)
    process.exit(1)
  }
}

main()
