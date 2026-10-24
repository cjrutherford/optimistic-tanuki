# N04 shared audit erasure — proposed decision

Status: proposed; awaiting the user's data-policy choice. This does not amend the accepted policy or authorize a live purge.

N04 requires immediate account-erasure behavior for identifiable audit/activity sinks. Existing Social/Forum dispositions define safe exports, not erasure of a row that describes two people. Several identity columns are non-nullable. Choosing a deletion policy changes another participant's recorded history; it is not merely a logging implementation detail.

The recommended outcome is to preserve a minimal counterpart receipt while removing the deleting account's identifying fields and unreviewed free text. This requires explicit nullable-field/schema support, producer/reader changes, and owning-service generated migrations. It must not substitute a real person's UUID, a shared synthetic account, or a stable per-deleted-account pseudonym. It must not retain raw JSON/text just because direct identity fields were removed. A retained receipt is not promised to be anonymous against arbitrary external correlation.

| Source                           | Proposed operation after verified account/profile selection                                                                                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profile/Assets guardian activity | Remove matching account/profile fields; preserve only the agreed counterpart and narrow operation/time receipt. Drop unreviewed payload/reference fields in the affected receipt. Never cascade into the counterpart profile or asset. |
| Social personal activity         | Remove the person's private activity facts; do not traverse resource references into shared content.                                                                                                                                   |
| Social membership/guardian audit | Separate account-actor and profile-subject identity domains. Remove the matched party's identity and unreviewed payload; retain only the approved counterpart lifecycle receipt.                                                       |
| Social/Forum moderation audit    | Remove the matched actor-profile identity and unreviewed details. Moderated subject IDs are content references, not profile IDs. Preserve underlying posts/reports and other participants' audit rows.                                 |
| Active authorization grants      | Do not assume a grant is a passive audit record. Revocation/fencing must precede any history transform under the corresponding owner/D00 contract.                                                                                     |

The alternative is to delete audit rows that contain the deleting account as an authorized actor/dependent/subject. This removes some counterpart history as well. It still must preserve underlying posts, assets, communities and unrelated audit rows; it cannot cascade through a resource or counterpart identifier.

After the choice, implement the explicit per-owner transforms, generate required migrations with each service's Nx target, and prove mixed-party preservation, failure/retry, independent account readback and new-writer fencing. D00 remains responsible for the authenticated durable operation and permanent distributed fence. The current helper deliberately reports unresolved shared sinks rather than approving deletion.

The local Docker metadata inventory found no current or stopped containers labelled with the required OT/TS compose service names. It did not inspect payloads, erase historical logs, or prove absence of unlabelled file/forwarded/backup copies. Production collector and legacy-copy disposition remain operator qualification; the new Node/browser boundaries prevent unstructured application diagnostics from becoming new payload copies.
