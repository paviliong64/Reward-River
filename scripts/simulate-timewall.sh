#!/usr/bin/env bash
# ==============================================================================
# TimeWall.io Postback Curl Simulation Suite for Reward River
# ==============================================================================
# Usage:
#   BASE_URL="http://localhost:3000" \
#   TIMEWALL_SECRET="your_timewall_secret" \
#   USER_ID="usr_admin_rewardriver" \
#   bash scripts/simulate-timewall.sh
# ==============================================================================

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
SECRET="${TIMEWALL_SECRET:-3e8f2c753e704d59013d34c6474363c3}"
USER_ID="${USER_ID:-usr_admin_rewardriver}"
WHITELISTED_IP="18.156.132.55"

sha256_hex() {
  printf "%s" "$1" | openssl dgst -sha256 | awk '{print $NF}' | tr '[:upper:]' '[:lower:]'
}

echo "=================================================================="
echo "TimeWall.io Postback Simulation against: ${BASE_URL}"
echo "Target User ID: ${USER_ID}"
echo "=================================================================="

# 1. Valid postback with sub-cent revenue "0.002" (10 coins at 5000/USD)
TX1="tw_curl_002_$(date +%s)"
REV1="0.002"
HASH1=$(sha256_hex "${USER_ID}${REV1}${SECRET}")
echo ""
echo "[1/9] Valid sub-cent postback (revenue=\"0.002\", currency=10):"
curl -sS -i -H "CF-Connecting-IP: ${WHITELISTED_IP}" \
  "${BASE_URL}/postback/timewall?userid=${USER_ID}&txid=${TX1}&revenue=${REV1}&currency=10&hash=${HASH1}&ip=203.0.113.5&type=credit&offername=SubCentTask&offerdetail=CompleteQuiz" | head -n 15

# 2. Valid postback with trailing-zero revenue "0.50" (2500 coins at 5000/USD)
TX2="tw_curl_050_$(date +%s)"
REV2="0.50"
HASH2=$(sha256_hex "${USER_ID}${REV2}${SECRET}")
echo ""
echo "[2/9] Valid trailing-zero postback (revenue=\"0.50\", currency=2500):"
curl -sS -i -H "CF-Connecting-IP: ${WHITELISTED_IP}" \
  "${BASE_URL}/postback/timewall?userid=${USER_ID}&txid=${TX2}&revenue=${REV2}&currency=2500&hash=${HASH2}&ip=203.0.113.5&type=credit&offername=Survey50" | head -n 15

# 3. Duplicate txid (idempotency check)
echo ""
echo "[3/9] Duplicate txid (${TX2}) - must return HTTP 200 OK without double crediting:"
curl -sS -i -H "CF-Connecting-IP: ${WHITELISTED_IP}" \
  "${BASE_URL}/postback/timewall?userid=${USER_ID}&txid=${TX2}&revenue=${REV2}&currency=2500&hash=${HASH2}&ip=203.0.113.5&type=credit" | head -n 15

# 4. Bad SHA-256 hash (must return HTTP 403 INVALID_HASH)
TX4="tw_curl_badhash_$(date +%s)"
echo ""
echo "[4/9] Invalid SHA-256 hash - must return HTTP 403 INVALID_HASH:"
curl -sS -i -H "CF-Connecting-IP: ${WHITELISTED_IP}" \
  "${BASE_URL}/postback/timewall?userid=${USER_ID}&txid=${TX4}&revenue=0.50&currency=2500&hash=0000000000000000000000000000000000000000000000000000000000000000&ip=203.0.113.5" | head -n 15

# 5. Non-whitelisted IP (must return HTTP 403 FORBIDDEN_IP)
TX5="tw_curl_badip_$(date +%s)"
HASH5=$(sha256_hex "${USER_ID}0.10${SECRET}")
echo ""
echo "[5/9] Non-whitelisted source IP (198.51.100.25) - must return HTTP 403 FORBIDDEN_IP:"
curl -sS -i -H "CF-Connecting-IP: 198.51.100.25" \
  "${BASE_URL}/postback/timewall?userid=${USER_ID}&txid=${TX5}&revenue=0.10&currency=500&hash=${HASH5}&ip=203.0.113.5" | head -n 15

# 6. Unknown user (must return HTTP 200 OK so TimeWall does not retry forever)
TX6="tw_curl_unknown_$(date +%s)"
UNKNOWN_UID="usr_nonexistent_999999"
HASH6=$(sha256_hex "${UNKNOWN_UID}0.10${SECRET}")
echo ""
echo "[6/9] Unknown userid (${UNKNOWN_UID}) - must return HTTP 200 OK:"
curl -sS -i -H "CF-Connecting-IP: ${WHITELISTED_IP}" \
  "${BASE_URL}/postback/timewall?userid=${UNKNOWN_UID}&txid=${TX6}&revenue=0.10&currency=500&hash=${HASH6}&ip=203.0.113.5" | head -n 15

# 7. Currency mismatch (must put transaction in needs_review and return HTTP 200 OK)
TX7="tw_curl_mismatch_$(date +%s)"
HASH7=$(sha256_hex "${USER_ID}0.10${SECRET}")
echo ""
echo "[7/9] Currency mismatch (revenue=0.10, currency=99999) - must hold in needs_review & return HTTP 200 OK:"
curl -sS -i -H "CF-Connecting-IP: ${WHITELISTED_IP}" \
  "${BASE_URL}/postback/timewall?userid=${USER_ID}&txid=${TX7}&revenue=0.10&currency=99999&hash=${HASH7}&ip=203.0.113.5&offername=MismatchOffer" | head -n 15

# 8. Reversal of TX2
echo ""
echo "[8/9] Reversal postback for ${TX2} (type=chargeback) - must deduct 2500 coins once:"
curl -sS -i -H "CF-Connecting-IP: ${WHITELISTED_IP}" \
  "${BASE_URL}/postback/timewall?userid=${USER_ID}&txid=${TX2}&revenue=${REV2}&currency=2500&hash=${HASH2}&ip=203.0.113.5&type=chargeback&reason=advertiser_reversal" | head -n 15

# 9. Concurrent duplicate requests
TX9="tw_curl_concurrent_$(date +%s)"
HASH9=$(sha256_hex "${USER_ID}0.20${SECRET}")
echo ""
echo "[9/9] Firing 5 concurrent duplicate requests for txid=${TX9}:"
for i in 1 2 3 4 5; do
  curl -sS -o /dev/null -w "  Worker #${i}: HTTP %{http_code}\n" -H "CF-Connecting-IP: ${WHITELISTED_IP}" \
    "${BASE_URL}/postback/timewall?userid=${USER_ID}&txid=${TX9}&revenue=0.20&currency=1000&hash=${HASH9}&ip=203.0.113.5&type=credit" &
done
wait
echo "Done."
