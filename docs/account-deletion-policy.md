# NearFIX Account Deletion Data Handling

`DELETE /auth/me` performs authenticated account anonymization.

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
