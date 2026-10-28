/** Atomic with creation scripts: no callback can repopulate an account after purge. */
export const OAUTH_ACCOUNT_CLEANUP_SCRIPT = `
local fenced = redis.call('HEXISTS', KEYS[3], ARGV[4]) == 1
if ARGV[6] == 'purge' then
  if not fenced and redis.call('HLEN', KEYS[3]) >= tonumber(ARGV[5]) then return -1 end
  redis.call('HSET', KEYS[3], ARGV[4], '1')
elseif not fenced then
  return -2
end
local remaining = 0
for family = 1,2 do
  if redis.call('ZCARD', KEYS[family]) > tonumber(ARGV[5]) then return -3 end
  -- Include orphaned legacy keys, not only indexed copies. SCAN work and the
  -- number of retained keys are bounded; unknown/corrupt inventory fails closed.
  local keys = {}
  local found = {}
  local cursor = '0'
  local pages = 0
  repeat
    local page = redis.call('SCAN', cursor, 'MATCH', ARGV[family] .. '*', 'COUNT', 100)
    cursor = page[1]
    pages = pages + 1
    if pages > 1000 then return -5 end
    for _,key in ipairs(page[2]) do
      if key ~= KEYS[family] and not found[key] then
        found[key] = true
        table.insert(keys, key)
        if #keys > tonumber(ARGV[5]) then return -3 end
      end
    end
  until cursor == '0'
  for _,key in ipairs(keys) do
    local id = string.sub(key, string.len(ARGV[family]) + 1)
    local raw = redis.call('GET', key)
    if raw then
      local ok,value = pcall(cjson.decode, raw)
      if not ok or type(value) ~= 'table' then return -4 end
      local account
      if family == 1 then
        if type(value.payload) ~= 'table' then return -4 end
        account = value.payload.linkUserId
      else
        account = value.userId
        if type(account) ~= 'string' then return -4 end
      end
      if account ~= nil and type(account) ~= 'string' then return -4 end
      if account and string.lower(account) == ARGV[3] then
        if ARGV[6] == 'purge' then
          redis.call('DEL', key)
          redis.call('ZREM', KEYS[family], id)
        else
          remaining = remaining + 1
        end
      end
    elseif ARGV[6] == 'purge' then
      redis.call('ZREM', KEYS[family], id)
    end
  end
end
return remaining
`;
