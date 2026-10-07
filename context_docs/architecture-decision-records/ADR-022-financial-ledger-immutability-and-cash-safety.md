# ADR-022: Financial Ledger Foreign Key Immutability and Soft-Deletion Policy

- **Status**: Accepted
- **Date**: 2026-10-05
- **Deciders**: Platform Architecture Board, Finance & Compliance Team
- **Related**: [ADR-009](./ADR-009-deterministic-financial-accounting-ledger.md) (financial accounting ledger)

## Context

Financial accounting ledgers (`commission_ledgers`, `rider_trip_ledgers`, `settlement_batches`, `cash_deposits`) represent legal and audit records of monetary transactions across merchants, couriers, and the platform. Cascade deletions or unconstrained entity drops could destroy audit trails or cause ledger discrepancies between order totals and settlement batches.

## Decision

1. **Deletion Immutability**:
   - Financial ledger entries cannot be hard deleted once created.
   - Database foreign key constraints on financial models use `RESTRICT` on delete, preventing parent records (orders, settlement batches, vendors, riders) from being deleted while ledger records reference them.
2. **Guarded State Transitions**:
   - Cash deposit approvals (`verifyCashDeposit`) and courier delivery completions (`deliverOrder`) execute inside ACID transactions with optimistic locking (`updateMany` conditional status checks), guaranteeing single-execution semantics.
3. **Audit Trail Completeness**:
   - Any order cancellations after payment confirmation trigger an explicit audit log and automatic online gateway refund or COD reversal.

## Consequences

- Full financial integrity and auditability compliant with financial accounting standards.
- Zero risk of accidental or cascading deletion of historical settlement records.
