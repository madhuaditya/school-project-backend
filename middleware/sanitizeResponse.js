const SENSITIVE_FIELDS = [
  "password",
  "refreshToken",
  "resetToken",
  "resetTokenExp",
  "__v"
];

const toPlainObject = (value) => {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (typeof value.toObject === "function") {
    try {
      return value.toObject({
        getters: false,
        virtuals: false,
        flattenMaps: true,
      });
    } catch {
      return value;
    }
  }

  return value;
};

const sanitize = (data, seen = new WeakSet()) => {
  if (data == null) return data;

  if (typeof data !== "object") {
    return data;
  }

  if (data instanceof Date) {
    return data;
  }

  if (Buffer.isBuffer(data)) {
    return data;
  }

  if (Array.isArray(data)) {
    if (seen.has(data)) {
      return null;
    }
    seen.add(data);
    return data.map((item) => sanitize(item, seen));
  }

  const source = toPlainObject(data);
  if (!source || typeof source !== "object") {
    return source;
  }

  if (seen.has(source)) {
    return null;
  }
  seen.add(source);

  const newObj = {};
  for (const key of Object.keys(source)) {
    if (SENSITIVE_FIELDS.includes(key)) continue;
    newObj[key] = sanitize(source[key], seen);
  }

  return newObj;
};

const sanitizeResponse = (req, res, next) => {
  const oldJson = res.json;

  res.json = function (data) {
    const cleaned = sanitize(data);
    return oldJson.call(this, cleaned);
  };

  next();
};

module.exports = sanitizeResponse;