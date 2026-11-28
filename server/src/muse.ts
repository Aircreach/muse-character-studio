// server/src/muse.ts — 兼容转发层；所有 Muse 运行时隔离实现已迁移至 server/src/adapters/muse/。
// 核心业务层应通过 ActionContext.muse（MuseRuntimeProvider 接口）交互，而非直接依赖本地实现。

export {
  LOCAL_AUDITED_CAPABILITIES,
  LocalMuseProvider,
  MUSE_DEPENDENT_CODE,
  MuseDependentError,
  RUNTIME_BASE_HINT,
  RUNTIME_BASE_MD5,
  createLocalMuseProvider,
  readLocalRuntimeBase,
  readRuntimeMedia,
  runtimeAssetsUnavailable,
  type MuseCapabilities,
  type MuseRuntimeProvider,
  type RuntimeBaseFile,
} from './adapters/muse'
