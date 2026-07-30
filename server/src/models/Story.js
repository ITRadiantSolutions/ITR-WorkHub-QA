import mongoose from "mongoose";

const STORY_PREFIX = "STORY-";
const STORY_START = 101;

const storySchema = new mongoose.Schema(
  {
    storyId: { type: String, unique: true, index: true },
    title: { type: String, required: [true, "Story title is required"], trim: true },
    description: { type: String, trim: true, default: "" },

    storyPoints: { type: Number, required: [true, "Story points are required"], min: 0, default: 0 },
    priority: { type: String, enum: ["Low", "Medium", "High", "Critical"], default: "Medium" },
    status: { type: String, enum: ["To Do", "In Progress", "Testing", "Done"], default: "To Do" },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    acceptanceCriteria: { type: String, trim: true, default: "" },
    sprintId: { type: mongoose.Schema.Types.ObjectId, ref: "Sprint", required: [true, "Sprint is required"], index: true },

    comments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        text: { type: String, required: true, trim: true, minlength: 1 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

// Auto-generate STORY-101, STORY-102...
storySchema.pre("validate", async function () {
  if (this.storyId) return;

  const Story = mongoose.models.Story;
  const lastStory = await Story.findOne({}).sort({ createdAt: -1 }).select("storyId");

  let nextNumber = STORY_START;
  if (lastStory?.storyId) {
    const match = lastStory.storyId.match(/\d+$/);
    if (match) nextNumber = Number(match[0]) + 1;
  }

  this.storyId = `${STORY_PREFIX}${nextNumber}`;
});

export default mongoose.models.Story || mongoose.model("Story", storySchema);
