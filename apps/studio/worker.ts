import path from "node:path"
import process from "node:process"
import cron from "node-cron"
import dotenv from "dotenv"
import {
  createBatchGenerationTask,
  failInterruptedGenerationTasks,
  failInterruptedPostTasks,
  hasActiveBatchTaskForSeries,
  listQueuedGenerationTasks,
  listQueuedPostTasks,
  listSeries,
  runPairGenerationTask,
  runPostTask,
  runSingleGenerationTask,
} from "@icy/core"
import { getDb } from "./lib/db"
import { getGeneration, getImageCompose, getStorage } from "./lib/services"

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true })

type CronHandle = ReturnType<typeof cron.schedule>

const schedules = new Map<string, { expression: string; handle: CronHandle }>()
let stopping = false
let activeAbort: AbortController | null = null

function log(message: string) {
  console.log(`[icy-worker] ${message}`)
}

function logError(context: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[icy-worker] ${context}: ${message}`)
}

function syncSchedules() {
  const db = getDb()
  const active = listSeries(db, { active: true }).filter(
    (row) => row.batchConfig && row.scheduleCron,
  )
  const desired = new Set(active.map((row) => row.id))

  for (const [id, entry] of schedules) {
    if (!desired.has(id)) {
      entry.handle.destroy()
      schedules.delete(id)
    }
  }

  for (const row of active) {
    const expression = row.scheduleCron!
    const current = schedules.get(row.id)
    if (current?.expression === expression) continue
    current?.handle.destroy()

    if (!cron.validate(expression)) {
      logError(`系列「${row.name}」cron 无效`, expression)
      continue
    }

    const handle = cron.schedule(
      expression,
      () => {
        try {
          if (hasActiveBatchTaskForSeries(db, row.id)) {
            log(`跳过系列「${row.name}」：已有批次在排队或运行`)
            return
          }
          const task = createBatchGenerationTask(db, { seriesId: row.id })
          log(`系列「${row.name}」已创建批次 ${task.id}`)
        } catch (error) {
          logError(`创建系列「${row.name}」批次失败`, error)
        }
      },
      { noOverlap: true },
    )
    schedules.set(row.id, { expression, handle })
    log(`已注册系列「${row.name}」cron ${expression}`)
  }
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function runLoop() {
  const db = getDb()
  const interrupted = failInterruptedGenerationTasks(db)
  const interruptedPost = failInterruptedPostTasks(db)
  if (interrupted.length + interruptedPost.length > 0) {
    log(
      `已标记 ${interrupted.length} 个生成任务、${interruptedPost.length} 个后期任务为失败，等待人工重试`,
    )
  }
  syncSchedules()
  const scheduleTimer = setInterval(syncSchedules, 30_000)

  try {
    while (!stopping) {
      const generationTask = listQueuedGenerationTasks(db, { limit: 1 })[0]
      const postTask = listQueuedPostTasks(db, { limit: 1 })[0]
      if (!generationTask && !postTask) {
        await wait(750)
        continue
      }

      if (
        postTask &&
        (!generationTask || postTask.priority > generationTask.priority)
      ) {
        log(`开始 post 任务 ${postTask.id}`)
        try {
          await runPostTask(postTask.id, {
            db,
            storage: getStorage(),
            compose: getImageCompose(),
          })
          log(`结束 post 任务 ${postTask.id}`)
        } catch (error) {
          logError(`post 任务 ${postTask.id} 执行异常`, error)
        }
        continue
      }

      activeAbort = new AbortController()
      const task = generationTask!
      log(`开始 ${task.type} 任务 ${task.id}`)
      try {
        const deps = {
          db,
          generation: getGeneration(),
          storage: getStorage(),
          signal: activeAbort.signal,
        }
        if (task.type === "pair" || task.type === "batch") {
          await runPairGenerationTask(task.id, deps)
        } else {
          await runSingleGenerationTask(task.id, deps)
        }
        log(`结束任务 ${task.id}`)
      } catch (error) {
        logError(`任务 ${task.id} 执行异常`, error)
      } finally {
        activeAbort = null
      }
    }
  } finally {
    clearInterval(scheduleTimer)
    for (const entry of schedules.values()) entry.handle.destroy()
    schedules.clear()
  }
}

function stop(signal: string) {
  if (stopping) return
  stopping = true
  log(`收到 ${signal}，正在停止`)
  activeAbort?.abort()
}

process.once("SIGINT", () => stop("SIGINT"))
process.once("SIGTERM", () => stop("SIGTERM"))

runLoop().catch((error) => {
  logError("worker 退出", error)
  process.exitCode = 1
})
