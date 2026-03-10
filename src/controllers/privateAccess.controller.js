import { query } from "../config/db.js";
import { HttpError } from "../utils/httpError.js";

export const createRequest = async (req, res) => {
  const { profileId, message } = req.body;
  const { rows: profileRows } = await query("SELECT id, user_id FROM profiles WHERE id = $1 LIMIT 1", [profileId]);
  const profile = profileRows[0];
  if (!profile) throw new HttpError(404, "Profile not found");
  if (profile.user_id === req.user.userId) throw new HttpError(400, "Cannot request your own profile");

  const { rows: existing } = await query(
    `
      SELECT * FROM photo_access_requests
      WHERE requester_id = $1 AND profile_id = $2
      LIMIT 1
    `,
    [req.user.userId, profileId]
  );
  if (existing[0]) {
    return res.json({
      success: true,
      message: "Request already exists",
      data: existing[0],
    });
  }

  const { rows } = await query(
    `
      INSERT INTO photo_access_requests (requester_id, profile_id, status)
      VALUES ($1, $2, 'pending')
      RETURNING *
    `,
    [req.user.userId, profileId]
  );

  return res.status(201).json({
    success: true,
    message: "Request sent",
    data: rows[0],
  });
};

export const listIncoming = async (req, res) => {
  const { rows } = await query(
    `
      SELECT
        r.*,
        p.profile_id AS target_profile_code,
        u.id AS requester_user_id,
        prof.full_name AS requester_name,
        prof.city AS requester_city,
        prof.state AS requester_state,
        prof.photo_url AS requester_photo
      FROM photo_access_requests r
      JOIN profiles p ON p.id = r.profile_id
      JOIN users u ON u.id = r.requester_id
      LEFT JOIN profiles prof ON prof.user_id = u.id
      WHERE p.user_id = $1
      ORDER BY r.created_at DESC
    `,
    [req.user.userId]
  );

  return res.json({ success: true, message: "Incoming requests", data: rows });
};

export const listSent = async (req, res) => {
  const { rows } = await query(
    `
      SELECT
        r.*,
        p.profile_id AS target_profile_code,
        prof.full_name AS target_name,
        prof.city AS target_city,
        prof.state AS target_state,
        prof.photo_url AS target_photo
      FROM photo_access_requests r
      JOIN profiles p ON p.id = r.profile_id
      LEFT JOIN profiles prof ON prof.id = p.id
      WHERE r.requester_id = $1
      ORDER BY r.created_at DESC
    `,
    [req.user.userId]
  );

  return res.json({ success: true, message: "Sent requests", data: rows });
};

export const updateRequest = async (req, res) => {
  const { requestId } = req.params;
  const { action } = req.body;
  const status = action === "approve" ? "approved" : "rejected";

  const { rows } = await query(
    `
      SELECT r.*, p.user_id AS owner_user_id
      FROM photo_access_requests r
      JOIN profiles p ON p.id = r.profile_id
      WHERE r.id = $1
      LIMIT 1
    `,
    [requestId]
  );
  const request = rows[0];
  if (!request) throw new HttpError(404, "Request not found");
  if (request.owner_user_id !== req.user.userId) throw new HttpError(403, "Not allowed");

  const updated = await query(
    `
      UPDATE photo_access_requests
      SET status = $1, updated_at = now()
      WHERE id = $2
      RETURNING *
    `,
    [status, requestId]
  );

  return res.json({ success: true, message: "Request updated", data: updated.rows[0] });
};

