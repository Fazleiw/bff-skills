;; Provable Strategy Registry
;; Stores committed policy metadata and auditable execution receipts.

(define-constant err-unauthorized (err u100))
(define-constant err-not-found (err u101))
(define-constant err-expired (err u102))
(define-constant err-invalid-state (err u103))
(define-constant err-action-not-allowed (err u104))
(define-constant err-protocol-not-allowed (err u105))
(define-constant err-cap-exceeded (err u106))
(define-constant err-already-exists (err u107))

(define-data-var execution-seq uint u0)

(define-map strategies
  { strategy-id: (buff 64) }
  {
    executor: principal,
    policy-hash: (buff 32),
    expiry: uint,
    state: uint,
    protocol-mask: uint,
    action-mask: uint,
    max-allocation-bps: uint,
    max-single-action-bps: uint,
    spent-bps: uint,
    active: bool
  }
)

(define-map execution-log
  { execution-id: uint }
  {
    strategy-id: (buff 64),
    executor: principal,
    action-type: uint,
    protocol-id: uint,
    amount-bps: uint,
    external-txid-hash: (buff 32),
    block-height: uint
  }
)

(define-private (is-owner (strategy-id (buff 64)) (sender principal))
  (match (map-get? strategies { strategy-id: strategy-id })
    strategy (is-eq sender (get executor strategy))
    false
  )
)

(define-public (commit-strategy
  (strategy-id (buff 64))
  (policy-hash (buff 32))
  (expiry uint)
  (protocol-mask uint)
  (action-mask uint)
  (max-allocation-bps uint)
  (max-single-action-bps uint)
)
  (begin
    (asserts! (is-none (map-get? strategies { strategy-id: strategy-id })) err-already-exists)
    (map-set strategies
      { strategy-id: strategy-id }
      {
        executor: tx-sender,
        policy-hash: policy-hash,
        expiry: expiry,
        state: u0,
        protocol-mask: protocol-mask,
        action-mask: action-mask,
        max-allocation-bps: max-allocation-bps,
        max-single-action-bps: max-single-action-bps,
        spent-bps: u0,
        active: true
      }
    )
    (ok true)
  )
)

(define-public (advance-state (strategy-id (buff 64)) (next-state uint))
  (let ((strategy (unwrap! (map-get? strategies { strategy-id: strategy-id }) err-not-found)))
    (begin
      (asserts! (is-eq tx-sender (get executor strategy)) err-unauthorized)
      (asserts! (< (get state strategy) next-state) err-invalid-state)
      (map-set strategies
        { strategy-id: strategy-id }
        (merge strategy { state: next-state })
      )
      (ok true)
    )
  )
)

(define-public (record-execution
  (strategy-id (buff 64))
  (action-type uint)
  (protocol-id uint)
  (amount-bps uint)
  (external-txid-hash (buff 32))
)
  (let (
      (strategy (unwrap! (map-get? strategies { strategy-id: strategy-id }) err-not-found))
      (new-spent (+ (get spent-bps strategy) amount-bps))
      (next-id (+ (var-get execution-seq) u1))
    )
    (begin
      (asserts! (is-eq tx-sender (get executor strategy)) err-unauthorized)
      (asserts! (get active strategy) err-invalid-state)
      (asserts! (< block-height (get expiry strategy)) err-expired)
      (asserts! (<= amount-bps (get max-single-action-bps strategy)) err-cap-exceeded)
      (asserts! (<= new-spent (get max-allocation-bps strategy)) err-cap-exceeded)
      (asserts! (> (get action-mask strategy) u0) err-action-not-allowed)
      (asserts! (> (get protocol-mask strategy) u0) err-protocol-not-allowed)
      (map-set execution-log
        { execution-id: next-id }
        {
          strategy-id: strategy-id,
          executor: tx-sender,
          action-type: action-type,
          protocol-id: protocol-id,
          amount-bps: amount-bps,
          external-txid-hash: external-txid-hash,
          block-height: block-height
        }
      )
      (var-set execution-seq next-id)
      (map-set strategies
        { strategy-id: strategy-id }
        (merge strategy { spent-bps: new-spent })
      )
      (ok next-id)
    )
  )
)

(define-public (complete-strategy (strategy-id (buff 64)))
  (let ((strategy (unwrap! (map-get? strategies { strategy-id: strategy-id }) err-not-found)))
    (begin
      (asserts! (is-eq tx-sender (get executor strategy)) err-unauthorized)
      (map-set strategies
        { strategy-id: strategy-id }
        (merge strategy { active: false, state: u4 })
      )
      (ok true)
    )
  )
)

(define-read-only (get-strategy (strategy-id (buff 64)))
  (map-get? strategies { strategy-id: strategy-id })
)
