import { useEffect, useMemo, useState } from "react";
import { Plus, Users, ChevronDown, ChevronUp, Trash2, Pencil, X } from "lucide-react";
import getAuthAxios from "../utils/authAxios";
import Loader from "../PMS/components/Loader";
import Swal from "sweetalert2";
import { AnimatePresence, motion } from "framer-motion";

export default function UserGroups() {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [search, setSearch] = useState("");

  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");

  const [openGroup, setOpenGroup] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState(null);


  const getUserId = (u) => u._id || u.id;
  const getGroupId = (g) => g._id || g.id;

  // const isOpen = openGroup[g._id];



  /* ---------------- FETCH DATA ---------------- */
  useEffect(() => {
    let mounted = true;

    const fetchUsers = async () => {
      try {
        const api = await getAuthAxios();
        const res = await api.get("/users/");

        if (!mounted) return;

        const data =
          Array.isArray(res.data)
            ? res.data
            : res.data?.data || [];

        setUsers(data);
      } catch (err) {
        console.error("Users fetch failed:", err);
      }
    };

    const fetchGroups = async () => {
      try {
        const api = await getAuthAxios();
        const res = await api.get("/usersgroup");

        if (!mounted) return;

        const data =
          Array.isArray(res.data)
            ? res.data
            : res.data?.data || [];

        setGroups(data);
      } catch (err) {
        if (err.response?.status === 404) {
          setGroups([]); // no groups yet = normal
        } else {
          console.error("Groups fetch failed:", err);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchUsers();
    fetchGroups();

    return () => {
      mounted = false;
    };
  }, []);
  /* ---------------- SEARCH USERS ---------------- */
  const filteredUsers = useMemo(() => {
    return users.filter((u) =>
      u.name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [users, search]);


  /* ---------------- SELECT USER ---------------- */
  const toggleUser = (id) => {
    const strId = String(id);
    setSelectedUsers((prev) =>
      prev.includes(strId)
        ? prev.filter((x) => x !== strId)
        : [...prev, strId]
    );
    setSearch("");
  };

  /* ---------------- CREATE GROUP ---------------- */
  const saveGroup = async () => {
    if (!groupName.trim()) {
      return Swal.fire({
        icon: "warning",
        title: "Group name required"
      });
    }

    if (selectedUsers.length === 0) {
      return Swal.fire({
        icon: "warning",
        title: "Select at least one member"
      });
    }

    try {
      const api = await getAuthAxios();

      if (editMode) {
        await api.put(`/usersgroup/${editingGroupId}`, {
          name: groupName,
          description,
          members: selectedUsers,
        });
      } else {
        await api.post("/usersgroup", {
          name: groupName,
          description,
          members: selectedUsers,
        });
      }

      // refresh list
      const res = await api.get("/usersgroup");
      setGroups(res.data || []);

      // ✅ SUCCESS ALERT
      Swal.fire({
        icon: "success",
        title: editMode ? "Group Updated" : "Group Created",
        text: editMode
          ? "Group updated successfully"
          : "Group created successfully",
        timer: 1800,
        showConfirmButton: false
      });

      // reset modal
      setShowCreate(false);
      setSelectedUsers([]);
      setGroupName("");
      setDescription("");
      setEditMode(false);
      setEditingGroupId(null);

    } catch (err) {
      console.error(err);

      Swal.fire({
        icon: "error",
        title: "Save Failed",
        text: "Unable to save group. Please try again."
      });
    }
  };


  const openCreateModal = () => {
    setEditMode(false);
    setEditingGroupId(null);
    setGroupName("");
    setDescription("");
    setSelectedUsers([]);
    setShowCreate(true);
  };
  const deleteGroup = async (id) => {

    const result = await Swal.fire({
      title: "Delete Group?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete it",
      cancelButtonText: "Cancel"
    });

    if (!result.isConfirmed) return;

    try {
      const api = await getAuthAxios();
      await api.delete(`/usersgroup/${id}`);

      setGroups(prev =>
        prev.filter(g => getGroupId(g) !== id)
      );

      // success alert
      Swal.fire({
        icon: "success",
        title: "Deleted",
        text: "Group deleted successfully",
        timer: 1800,
        showConfirmButton: false
      });

    } catch (err) {
      console.error(err);

      // error alert
      Swal.fire({
        icon: "error",
        title: "Delete Failed",
        text: "Unable to delete the group. Please try again.",
        confirmButtonColor: "#ef4444"
      });
    }
  };


  const openEditModal = (group) => {
    setEditMode(true);
    setEditingGroupId(getGroupId(group));   // ✅ FIX
    setGroupName(group.name);
    setDescription(group.description || "");
    setSelectedUsers((group.members || []).map(id => String(id)));
    setShowCreate(true);
  };


  /* ---------------- LOADER ---------------- */
  if (loading) return <Loader />;
  ////////////////////
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">

      {/* ================= HEADER ================= */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2 text-slate-800">
          <Users className="w-6 h-6 text-blue-600" />
          Employee Groups
        </h1>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-2 rounded-xl
                     bg-gradient-to-r from-blue-600 to-indigo-600
                     text-white text-sm font-semibold
                     shadow-lg hover:scale-105 transition"
        >
          <Plus size={18} />
          Create Group
        </button>
      </div>

      {/* ================= GROUP LIST ================= */}
      <div className="grid md:grid-cols-3 gap-5">
        {groups.length === 0 ? (
          <p className="text-sm text-gray-400">No groups created yet</p>
        ) : (
          groups.map((g) => {
            const groupId = g._id || g.id;
            const isOpen = openGroup === groupId;


            return (
              <div
                key={groupId}
                className="rounded-2xl border border-gray-300 bg-white shadow-sm overflow-hidden self-start"
              >

                {/* HEADER */}
                <div

                  onClick={() =>
                    setOpenGroup(openGroup === groupId ? null : groupId)
                  }

                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50"
                >
                  <div>
                    <p className="font-semibold text-slate-800">
                      {g.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {g.members?.length || 0} members
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(g);
                      }}

                      className="p-1.5 rounded-lg hover:bg-blue-100 transition"
                      title="Edit Group"
                    >
                      <Pencil size={16} className="text-blue-600" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // deleteGroup(g._id);
                        deleteGroup(groupId);

                      }}
                      className="p-1.5 rounded-lg hover:bg-red-100 transition"
                      title="Delete Group"
                    >
                      <Trash2 size={16} className="text-red-600" />
                    </button>

                    {isOpen ? (
                      <ChevronUp size={18} className="text-gray-600" />
                    ) : (
                      <ChevronDown size={18} className="text-gray-600" />
                    )}
                  </div>


                </div>

                {/* BODY */}
                {isOpen && (
                  <div className="px-5 pb-4 border-border-gray-300 t bg-slate-50">

                    {g.description && (
                      <p className="text-sm text-gray-600 pt-3">
                        {g.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 pt-3 max-h-40 overflow-y-auto">
                      {g.members?.map((id) => {
                        const user = users.find(
                          (u) => getUserId(u) === id
                        );
                        return (
                          <span
                            key={id}
                            className="px-3 py-1 text-xs rounded-full
                     bg-blue-100 text-blue-700 font-medium"
                          >
                            {user?.name || "Unknown"}
                          </span>
                        );
                      })}
                    </div>

                  </div>

                )}
              </div>
            );
          })
        )}
      </div>

      {/* ================= CREATE MODAL ================= */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreate(false)} // click outside close
          >

            {/* ================= MODAL CARD ================= */}
            <motion.div
              onClick={(e) => e.stopPropagation()} // prevent outside close when clicking inside
              initial={{ scale: 0.94, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.94, y: 30, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="
          w-full max-w-xl
          max-h-[90vh]
          bg-white/90 backdrop-blur-xl
          rounded-3xl shadow-2xl border border-white/40
          flex flex-col overflow-hidden
        "
            >

              {/* ================= HEADER ================= */}
              <div className="flex items-start justify-between px-6 py-4 border-b bg-white/70 backdrop-blur shrink-0">
                <h2 className="text-lg font-semibold text-slate-800">
                  {editMode ? "Update Group" : "Create New Group"}
                </h2>

                <p className="text-xs text-gray-500 mt-0.5">
                  {editMode
                    ? "Modify group details and members"
                    : "Organize users into a group"}
                </p>


                <button
                  onClick={() => setShowCreate(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* ================= SCROLLABLE BODY ================= */}
              <div className="flex-1 overflow-y-auto px-4 py-2 space-y-5">

                {/* GROUP NAME */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">
                    Group Name
                  </label>
                  <input
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Enter group name"
                    className="w-full px-4 py-2.5 text-sm border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* DESCRIPTION */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-0">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Describe this group..."
                    className="w-full px-2 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* SEARCH */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">
                    Add Members
                  </label>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search users..."
                    className="w-full px-4 py-2.5 text-sm border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* COUNT */}
                <div className="flex justify-between items-center">
                  <p className="text-xs text-gray-500">
                    Click user to select
                  </p>

                  <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full">
                    {selectedUsers.length} selected
                  </span>
                </div>

                {/* USER LIST */}
                <div className="max-h-64 overflow-y-auto rounded-xl border divide-y bg-white">

                  {filteredUsers.map((u) => {
                    const id = getUserId(u);
                    const selected = selectedUsers.includes(String(id));

                    return (
                      <motion.div
                        key={id}
                        layout
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggleUser(id)}
                        className={`flex justify-between items-center px-4 py-2.5 text-sm cursor-pointer transition
                    ${selected
                            ? "bg-indigo-50 text-indigo-700"
                            : "hover:bg-gray-50"
                          }`}
                      >
                        {u.name}

                        <AnimatePresence>
                          {selected && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              className="text-xs font-semibold"
                            >
                              ✓
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}

                </div>

              </div>

              {/* ================= FOOTER ================= */}
              <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 shrink-0">

                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm border rounded-xl hover:bg-gray-100 transition"
                >
                  Cancel
                </button>

                <button
                  onClick={saveGroup}
                  className="px-6 py-2 text-sm rounded-xl text-white font-semibold
                       bg-gradient-to-r from-indigo-600 to-blue-600
                       shadow-md hover:shadow-lg hover:scale-[1.02] transition"
                >
                  {editMode ? "Save Update" : "Save Group"}
                </button>

              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
}