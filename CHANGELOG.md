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
