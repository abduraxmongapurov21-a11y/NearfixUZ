# NearFIX Account Deletion Data Handling

`DELETE /auth/me` performs authenticated account anonymization.

If the account has an order that is neither completed nor cancelled, deletion returns `409 ACTIVE_ORDERS_EXIST` without modifying the account or revoking its session. This applies to orders where the account is the client or the provider. The user must cancel or complete those orders before retrying deletion.

Account deletion and order creation lock the same user records before checking eligibility, so a concurrent request cannot leave a new active order attached to a deleted participant. Historical orders already affected by provider deletion can still be cancelled; releasing their reservation keeps the deleted provider offline and preserves any other active reservation.

Immediately removed:

- active session access through revocation;
- push tokens;
- saved addresses;
- favorites;
- user notifications;
- outstanding OTP challenges for the original phone number.

Anonymized:

- phone number is replaced with a unique non-login identifier;
- name is replaced with a deleted-user label;
- city is removed;
- worker profession, biography, profile image reference and pricing fields are cleared;
- worker availability is set to offline and the profile is suspended.

Retained:

- orders and operational order events;
- reviews;
- chat and support history;
- transaction/payment records;
- order/chat media required as historical user content.

Retained records continue to reference the anonymized user row so operational history remains internally consistent. Storage-object deletion for retained order/chat media requires a separate retention policy and is intentionally not performed by the account deletion transaction.
