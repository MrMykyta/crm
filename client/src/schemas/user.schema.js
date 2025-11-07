// src/schemas/user.schema.js
export const USER_MAX = {
  firstName: 64,
  lastName : 64,
  email    : 160,
  phone    : 40,
  position : 80,
  city     : 128,
  about    : 1000,
};

export function userSchema(_i18n) {
  return [
    { kind: "section", title: "Основное" },

    { name: "firstName", label: "user.form.fields.firstName", type: "text",
      max: USER_MAX.firstName, float: true, required: true },

    { name: "lastName",  label: "user.form.fields.lastName",  type: "text",
      max: USER_MAX.lastName,  float: true, required: true },

    { name: "email",     label: "user.form.fields.email",     type: "text",
      max: USER_MAX.email,     float: true, required: true },

    { name: "phone",     label: "user.form.fields.phone",     type: "text",
      max: USER_MAX.phone,     float: true, placeholder: "+48 123 456 789" },

    { name: "position",  label: "user.form.fields.position",  type: "text",
      max: USER_MAX.position,  float: true },

    { name: "city",      label: "user.form.fields.city",      type: "text",
      max: USER_MAX.city,      float: true },

    { kind: "section", title: "О себе" },
    { name: "about",    label: "user.form.fields.about", type: "textarea",
      rows: 5, full: true, max: USER_MAX.about, float: true },
  ];
}

// нормализация туда/обратно
export const toFormUser = (d) => {
 const u = d?.user ? d.user : d || {};
    return {
      firstName:  u.firstName ?? "",
      lastName:   u.lastName  ?? "",
      email:      u.email     ?? u.emailNorm ?? u.emailRaw ?? "",
      phone:      u.phone     ?? u.phoneNorm ?? u.phoneRaw ?? "",
      position:   u.position  ?? "",
      city:       u.city      ?? "",
      about:      u.about     ?? "",
      avatarUrl:  u.avatarUrl ?? "",
    };
  };

export const toApiUser = (v) => ({
  firstName:  v.firstName?.trim(),
  lastName:   v.lastName?.trim(),
  email:      trimOrNull(v.email),
  phone:      trimOrNull(v.phone),
  position:   trimOrNull(v.position),
  city:       trimOrNull(v.city),
  about:      trimOrNull(v.about),
  avatarUrl:  trimOrNull(v.avatarUrl),
});

const trimOrNull = (x) => {
  if (x == null) return null;
  const s = String(x).trim();
  return s ? s : null;
};