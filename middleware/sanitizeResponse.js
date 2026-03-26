const SENSITIVE_FIELDS = [
  "password",
  "refreshToken",
  "resetToken",
  "resetTokenExp",
  "__v"
];

const sanitize = (data) => {
  if (!data) return data;

  if (Array.isArray(data)) {
    return data.map(sanitize);
  }

  if (typeof data === "object") {
    const newObj = {};

    for (let key in data) {
      if (SENSITIVE_FIELDS.includes(key)) continue;

      newObj[key] = sanitize(data[key]);
    }

    return newObj;
  }

  return data;
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