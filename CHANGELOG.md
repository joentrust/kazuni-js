## [0.5.1](https://github.com/kazunihq/kazuni-js/compare/v0.5.0...v0.5.1) (2026-07-30)


### Bug Fixes

* point the default base URL at api.usekazuni.com ([#5](https://github.com/kazunihq/kazuni-js/issues/5)) ([e89cdb4](https://github.com/kazunihq/kazuni-js/commit/e89cdb400211c08db7e4e12f2c2dc51af0ae46ff))
* stop the release workflow leaving main red ([#6](https://github.com/kazunihq/kazuni-js/issues/6)) ([27fd993](https://github.com/kazunihq/kazuni-js/commit/27fd99349cfe7912e873ae0fe1038c6ceef5c6c0))
# [0.5.0](https://github.com/kazunihq/kazuni-js/compare/v0.4.0...v0.5.0) (2026-07-27)
# 0.5.0 (2026-07-27)


### Features

* add optional `scheduledAt` to `send.email()` and `send.sms()` to schedule a future send
* add `messages.cancel(id)` to cancel a scheduled message before it sends
* add `"scheduled"` and `"canceled"` to `MessageStatus`, and `scheduledAt` to `GetMessageResponse`


# 0.4.0 (2026-07-23)


### Bug Fixes

* export SendSmsParams and SendMessageResponse ([c9f0eb1](https://github.com/kazunihq/kazuni-js/commit/c9f0eb1cc4d8b839a6cf6d649697374bb7be6ae6))


### Features

* add kazuni.send.sms() and point messages.get() at /v1/messages/:id ([813f5b9](https://github.com/kazunihq/kazuni-js/commit/813f5b957253d34170d24962db1513413e995714))
