import serialize from 'serialize-javascript'
import getPort from 'get-port'
import { MultiThemePluginOptions } from '@/utils/optionsUtils'
import { createRepo } from '.'

export async function openWithConfig(
  tmpDirName: string,
  config: MultiThemePluginOptions
): Promise<{ url: string; stop: () => void }> {
  const repo = await createRepo({
    template: 'create-react-app',
    tmpDirName
  })

  const { filePath: tailwindConfigFilePath } = await repo.writeFile(
    'tailwind.test.config.js',
    `module.exports = {
        ...${JSON.stringify({
          content: ['./src/**/*.{js,jsx,ts,tsx}'],
          theme: {
            extend: {}
          }
        })},
        plugins: [require('tailwindcss-themer')(${serialize(config)})]
      }`
  )

  const port = await getPort()
  const { stop } = await repo.startServer({
    command: ['npm', ['run', 'start']],
    env: {
      PORT: port.toFixed(0),
      TAILWIND_CONFIG_PATH: tailwindConfigFilePath,
      BROWSER: 'none'
    },
    isServerStarted: ({ stdout, template, options }) => {
      const startupLogMatch: RegExpMatchArray | null = stdout.match(
        /Local:\s+http:\/\/localhost:(\d+)\s/
      )
      if (startupLogMatch) {
        const parsedPort = parseInt(startupLogMatch[1], 10)

        if (port !== parsedPort) {
          throw new Error(
            `Expected ${template} to start on port ${port}, but it started on port ${parsedPort}`
          )
        }

        return true
      }

      // Cancel waiting early if we see an error
      const errorLogMatch: RegExpMatchArray | null = stdout.match(
        /webpack compiled with \d+ error/
      )
      if (errorLogMatch) {
        throw new Error(
          `Could not start template with "${options.fullCommand}".\n\n${stdout}`
        )
      }

      return false
    }
  })

  return {
    url: `http://localhost:${port}`,
    stop
  }
}
