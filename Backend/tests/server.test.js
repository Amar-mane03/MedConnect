const request = require("supertest");
const app = require("../server");
const NGO = require("../models/NGO");
const Camp = require("../models/Camp");
const User = require("../models/user");
const jwt = require("jsonwebtoken");
const { requireMentor, JWT_SECRET } = require("../middlewares/authMiddleware");

describe("core API endpoints", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("GET /health reports that the API is running", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.timestamp).toBeDefined();
  });

  test("GET /api/community/demo-status reports seeded demo records", async () => {
    jest.spyOn(NGO, "exists").mockResolvedValue({ _id: "demo-ngo" });
    jest.spyOn(Camp, "exists").mockResolvedValue(null);

    const response = await request(app).get("/api/community/demo-status");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ demoMode: true });
  });

  test("case publishing authorization only allows verified mentors", () => {
    const next = jest.fn();
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    requireMentor({ user: { role: "mentor", mentorVerificationStatus: "pending" } }, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      message: "Your mentor credentials must be verified before you can publish case studies.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("verified mentors pass case publishing authorization", () => {
    const next = jest.fn();
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    requireMentor({ user: { role: "mentor", mentorVerificationStatus: "verified" } }, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  test("PATCH /api/auth/profile updates editable fields without changing account role", async () => {
    const userId = "507f1f77bcf86cd799439011";
    const user = { _id: userId, role: "student", isBanned: false, emailVerified: true };
    jest.spyOn(User, "findById").mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
    const updatedUser = { _id: userId, name: "Updated Student", role: "student" };
    const updateSpy = jest.spyOn(User, "findByIdAndUpdate").mockResolvedValue(updatedUser);
    const token = jwt.sign({ id: userId }, JWT_SECRET);

    const response = await request(app)
      .patch("/api/auth/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Updated Student", role: "admin", mentorVerificationStatus: "verified" });

    expect(response.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith(
      userId,
      { $set: { name: "Updated Student" } },
      expect.objectContaining({ new: true, runValidators: true })
    );
    expect(response.body.user.role).toBe("student");
  });
});
