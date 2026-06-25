# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.1.1](https://github.com/GuoSirius/enhance-axios/compare/v1.1.0...v1.1.1) (2026-06-25)


### Bug Fixes

* 修复 P0-P4 五个问题 ([c3de150](https://github.com/GuoSirius/enhance-axios/commit/c3de150dab72d5d5693e07260ede751b2e28dc51))


### Documentation

* update ([0485184](https://github.com/GuoSirius/enhance-axios/commit/0485184c4db05b9ecfcd0013fbd0f75212e82cd1))

## [1.1.0](https://github.com/GuoSirius/enhance-axios/compare/v1.0.4...v1.1.0) (2026-05-23)


### Features

* add token auth module with TokenManager ([67c8b1a](https://github.com/GuoSirius/enhance-axios/commit/67c8b1ac05843bbb804e266bf6459dad9c439f12))


### Bug Fixes

* await setLocalToken in refresh chain, fix test infinite retry loops ([624304d](https://github.com/GuoSirius/enhance-axios/commit/624304dad8fb16a00ef67f523860a68915992ba5))
* handle pendingRefresh rejection, getLocalToken exception, remove controller leak ([dbc7765](https://github.com/GuoSirius/enhance-axios/commit/dbc77658cfe6b1ca110fc143846f85abf1d80b57))
* remove reference to deleted defaultTokenFailure ([6c0be3c](https://github.com/GuoSirius/enhance-axios/commit/6c0be3cbe2593012d3ea17a35a65d4ac31f2383c))
* rename clearPendingRefresh→handleRefreshFailure everywhere, fix tests ([88db5ad](https://github.com/GuoSirius/enhance-axios/commit/88db5add775edffc796b3f00265eae729d958d9f))
* rewrite TokenManager, fix cleanup before retry ([ace9fd4](https://github.com/GuoSirius/enhance-axios/commit/ace9fd48f6f556c347064bce2eff4ed9fa717885))
* use fork pool for vitest to prevent OOM hang during release ([eb65b9d](https://github.com/GuoSirius/enhance-axios/commit/eb65b9d14d9f38436c78f77dee407941b348adf6))
* use npx vitest run (cross-platform), pool:forks in config handles OOM ([334dcb0](https://github.com/GuoSirius/enhance-axios/commit/334dcb0fbdab41a3b0e6da1073991ac60b97552d))


### Tests

* add token auth tests (5 tests) ([46d5ecf](https://github.com/GuoSirius/enhance-axios/commit/46d5ecfc9f9916f283f6c7392633d54405ae935c))
* add token refresh and header format tests (8 tests) ([41bbb71](https://github.com/GuoSirius/enhance-axios/commit/41bbb7197c001fb5c860f39b70b7baff705f1947))


### Code Refactoring

* extract dataTransform into separate module ([3a8c186](https://github.com/GuoSirius/enhance-axios/commit/3a8c18693ce9768a6b0cd9e29a31c15007b7dbd6))
* extract retry and helpers modules, clean up index.ts ([0cb956b](https://github.com/GuoSirius/enhance-axios/commit/0cb956b3544b7b40180befbf6468a646e789005d))


### Documentation

* add token auth feature to CLAUDE.md ([81741c6](https://github.com/GuoSirius/enhance-axios/commit/81741c6f48ff43cf42ba277d649d29484203f51b))
* update CLAUDE.md with token feature, module structure, test count ([9c5cb4f](https://github.com/GuoSirius/enhance-axios/commit/9c5cb4fba0f03b82850b5b254bd833b11252dbb0))

### [1.0.4](https://github.com/GuoSirius/enhance-axios/compare/v1.0.3...v1.0.4) (2026-05-23)


### Bug Fixes

* release script syncs version.ts only, dist handled by workflow ([0e02fce](https://github.com/GuoSirius/enhance-axios/commit/0e02fceee650e26ed70c376bc7d84ff6344a6f94))


### Documentation

* merge plan.md into CLAUDE.md, remove duplicate ([fe5f9a7](https://github.com/GuoSirius/enhance-axios/commit/fe5f9a7cd17fd03807a3de3ca2c40f04f89849a3))


### Code Refactoring

* read version from package.json, remove generated version.ts ([9384938](https://github.com/GuoSirius/enhance-axios/commit/9384938d54b7ba17a1daf2526c3b7ff9825b45c0))

### [1.0.3](https://github.com/GuoSirius/enhance-axios/compare/v1.0.2...v1.0.3) (2026-05-23)


### Bug Fixes

* smooth version selector rendering with ANSI escape codes ([b8102cf](https://github.com/GuoSirius/enhance-axios/commit/b8102cfe192132945c5995440e57b650d2c11827))
* sync version.ts and rebuild after standard-version bump ([c3442fa](https://github.com/GuoSirius/enhance-axios/commit/c3442fa36e3cf3a3ef85c355caf00143b1ff180b))

### [1.0.2](https://github.com/GuoSirius/enhance-axios/compare/v1.0.1...v1.0.2) (2026-05-23)


### Continuous Integration

* bump node to 24, add workflow_dispatch trigger ([9136e21](https://github.com/GuoSirius/enhance-axios/commit/9136e2136b4e0bedb21020e775e854b18dfdf1f1))
* move permissions to workflow level for release workflow ([7bd041f](https://github.com/GuoSirius/enhance-axios/commit/7bd041f8a2d701498796201d40591a338a161e06))

### 1.0.1 (2026-05-23)


### Features

* 初始化 enhance-axios 项目 ([16239a5](https://github.com/GuoSirius/enhance-axios/commit/16239a5bb0af0792de7678fc45f9fde5338153b9))
* 配置归一化和 Retry 重试扩展 ([bc62b5f](https://github.com/GuoSirius/enhance-axios/commit/bc62b5f716a0e1b0540615d16d1b866bbeff1fc0))
* 全面重构构建配置和增强功能 ([a9b2f01](https://github.com/GuoSirius/enhance-axios/commit/a9b2f01b8130758a715ecb7fb0e70f193a14b858))
* 完善构建配置和example测试页面 ([c237f5d](https://github.com/GuoSirius/enhance-axios/commit/c237f5d3923bad619af6aca444bfa9f0bec5f814))
* add commitlint, release script, changelog, GitHub Actions CI/CD ([51df69e](https://github.com/GuoSirius/enhance-axios/commit/51df69e1fc7f543be67495e643a885c8fd14007b))
* arrow-key version selector in release script ([5f9216a](https://github.com/GuoSirius/enhance-axios/commit/5f9216a410a102b5f8fbe183609d989547fac873))
* Example 可视化测试页面 ([204e43a](https://github.com/GuoSirius/enhance-axios/commit/204e43a48458eca87d5122256130e9dbe1e039b5))
* export hash from entry so users can hash in requestKey functions ([9403ac2](https://github.com/GuoSirius/enhance-axios/commit/9403ac2bec73c7d31376160521414aae8173f73e))
* pass hash as 2nd arg to requestKey function, let user decide whether to hash ([75f3984](https://github.com/GuoSirius/enhance-axios/commit/75f39844d8d87238acf4bfcc0a9d1f70348f6efa))
* retry shortcuts for statusCodes array and retryCondition function ([8950eb9](https://github.com/GuoSirius/enhance-axios/commit/8950eb92e6b6bfc4c32874de17493fa3936f97f8))
* simplify retry, add data auto-transform & cache busting with integration tests ([5b840b3](https://github.com/GuoSirius/enhance-axios/commit/5b840b3fbad74d94254b9e717582f69524a7ee32))


### Bug Fixes

* 修复RESTful方法URL传递错误，优化example日志系统 ([986b881](https://github.com/GuoSirius/enhance-axios/commit/986b881941f6bd7e0d1717843a48e8dcde67a82e))
* add mock adapters to tests, fix release script test step ([9e8072c](https://github.com/GuoSirius/enhance-axios/commit/9e8072c412d136d1a8edc03b746415bec03558e2))
* add shell:true to release script execSync calls ([62725dc](https://github.com/GuoSirius/enhance-axios/commit/62725dcdbc89055546962fd89a39691f96d6a0b2))
* add Window interface declaration to axios-shim.ts for typecheck ([cd79244](https://github.com/GuoSirius/enhance-axios/commit/cd79244d028fbe287f0c51bd00d35986b90bf4d7))
* biz retry - do retry directly in success handler instead of unreachable throw; comprehensive README rewrite matching source ([44758a2](https://github.com/GuoSirius/enhance-axios/commit/44758a22d42ae8fa8e54e39c276364da2062af0f))
* cancel request - clear old config keys before abort to prevent double-cleanup of new request's entry; pass config to registerRequest ([ed2f43f](https://github.com/GuoSirius/enhance-axios/commit/ed2f43fbe16bd7ca465f017bb6c4703923deef4f))
* create fresh readline interface per question to avoid raw mode conflict ([e71f361](https://github.com/GuoSirius/enhance-axios/commit/e71f361dafe622d36c43d522d3a3d2e73548c955))
* eslint config and lint errors, add globals for browser/node APIs ([c17a5a6](https://github.com/GuoSirius/enhance-axios/commit/c17a5a69a54a142dab0140c8d221e2cec74a2158))
* **example:** simplify biz error test - use built-in retryCondition, remove broken custom interceptor ([cfe92b7](https://github.com/GuoSirius/enhance-axios/commit/cfe92b71098ebb645fdfd0c5e6f14a23f0cc0003))
* **formData:** tighten isPlainObject to exclude FormData/Map/Set; remove dead File check in Blob branch ([2afc300](https://github.com/GuoSirius/enhance-axios/commit/2afc3000dac58a7fac6173d918df59e8bc36094f))
* hash template result in resolveRequestKey for consistency with generateDefaultKey ([acb7cdb](https://github.com/GuoSirius/enhance-axios/commit/acb7cdb4f2c1e69b2d457d6dd579531c07ed641e))
* IIFE构建排除axios，优化example测试页面 ([aeba94d](https://github.com/GuoSirius/enhance-axios/commit/aeba94dc9c43ace3e6fd0b71cfde8c9c91daf4de))
* **keyGenerator:** support bracket notation a.b[0].c, protect FormData/Blob from hash collision, safer toPlain ([5caa060](https://github.com/GuoSirius/enhance-axios/commit/5caa060362599510f7b05bbe9abd34c2524cab96))
* normalize config object defaults enabled to true at request level ([366cafb](https://github.com/GuoSirius/enhance-axios/commit/366cafb6773fe8b0ad386ff5ea5c41da0d541a5c))
* object config defaults enabled to true in normalize functions ([087b786](https://github.com/GuoSirius/enhance-axios/commit/087b7869f4b138b76ad58603641e1772f05b00bb))
* request-level config object defaults enabled to true via caller ([5d763f9](https://github.com/GuoSirius/enhance-axios/commit/5d763f9c9bed593af202fcbe0ed94e56c03361a4))
* restore missing test functions in example/index.html ([af7c4ed](https://github.com/GuoSirius/enhance-axios/commit/af7c4ed4f8871d753d70f767484f96db49166c69))
* shortcut configs (string/function/number/array) now imply enabled: true ([145409f](https://github.com/GuoSirius/enhance-axios/commit/145409f50a07a3721d5cf05366314df4126bcab5))
* shouldApply treats null same as undefined (all methods) ([891d9f5](https://github.com/GuoSirius/enhance-axios/commit/891d9f563b37d55528c63d0a2039fe230a22a0f8))
* strip _ from params/data during key generation, add defensive tests ([f148564](https://github.com/GuoSirius/enhance-axios/commit/f148564b5e7c42061682245a87bbd4091adf1db1))
* use exit code instead of regex for test check in release script ([f3cd6fb](https://github.com/GuoSirius/enhance-axios/commit/f3cd6fbbd6953672aa2df2a469551da8653f6511))


### Documentation

* 更新 README 构建输出说明 ([155d5c1](https://github.com/GuoSirius/enhance-axios/commit/155d5c1957d11aa45195bb357650692f3fbc8738))
* 更新计划文件 ([6e00fe7](https://github.com/GuoSirius/enhance-axios/commit/6e00fe7dbc7e7712a8df8da4064df3c6d4af783e))
* 添加详细的拦截器逻辑注释 ([366cc96](https://github.com/GuoSirius/enhance-axios/commit/366cc96b97f4f8fd2b279b1c918998b0728043e1))
* restore and update plan.md, add project memory rules ([0f6fdb2](https://github.com/GuoSirius/enhance-axios/commit/0f6fdb2b3791eb069752e678fa8b2096f07887bb))
* update header doc with pendingReturns/requestManager/enhance API; fix Content-Type check to be case-insensitive ([9cd5d0f](https://github.com/GuoSirius/enhance-axios/commit/9cd5d0ffe19bf1a25b4ee8a7b4833ec9a0f0363e))


### Code Refactoring

* 精简 package.json，使用独立配置文件 ([d024d50](https://github.com/GuoSirius/enhance-axios/commit/d024d5016e4cb572f7c3c4439e04401a3415ea57))
* extract shared isPlainObject to utils/common.ts, dedupe formData + keyGenerator ([bd7a4b0](https://github.com/GuoSirius/enhance-axios/commit/bd7a4b03728f6d33c6fc5d7cafde64e2cdef6b09))
* fix critical bugs and reduce duplication ([6cbebd4](https://github.com/GuoSirius/enhance-axios/commit/6cbebd4160ab1ca182e89b71c3eb4557bd726f2d))
* **formData:** unify top-level handling via appendValue, eliminate duplication ([6734d92](https://github.com/GuoSirius/enhance-axios/commit/6734d9218167c76d9be8bb326f1480e9cdc1b1d4))
* migrate to AbortController, add getFormData/contentType/2xx biz retry ([3397019](https://github.com/GuoSirius/enhance-axios/commit/3397019eaef7d63055ef3e6d34ff549ed41aed0d))
* rename cacheBusting→needCache, export retryCondition, fix null checks ([fefa142](https://github.com/GuoSirius/enhance-axios/commit/fefa14253f28434ee81a22d7099948136da5f7b7))
* rename needCache→needCacheBust, remove __cacheBustInjected, fix step numbers ([13b1df2](https://github.com/GuoSirius/enhance-axios/commit/13b1df20d5f3608924b4cf30e38de0643ed4c345))
* **requestManager:** remove empty constructor, extract abort helper, fix cancelRequest to check both maps ([596cdb6](https://github.com/GuoSirius/enhance-axios/commit/596cdb651dab020ed128ef9401a4a55b96e54b57))
