# fin-commander-data-access Usage

Use this library when the caller needs Fin Commander plan state and can provide an appropriate tenant/profile scope.

The important operational constraint is to set scope before relying on reads or writes, because persistence is partitioned by scope.
