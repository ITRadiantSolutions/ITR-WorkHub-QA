import mongoose from "mongoose";

// Rejects any route param that isn't a valid Mongo ObjectId before it reaches
// a controller — without this, an invalid id (e.g. a stale bookmark, a typo,
// or a probe) reaches Mongoose's findById/findOneAndUpdate and throws a
// CastError that leaks internal field/model names as a raw 500 instead of a
// clean 404.
export const validateObjectId = (paramName = "id") => (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params[paramName])) {
    return res.status(404).json({ message: "Resource not found" });
  }
  next();
};

// For use with router.param(name, objectIdParam) — validates every route on
// that router using a param of this name, e.g.:
//   router.param("id", objectIdParam);
//   router.param("projectId", objectIdParam);
export const objectIdParam = (req, res, next, value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return res.status(404).json({ message: "Resource not found" });
  }
  next();
};
