import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import {
  LogOut,
  User,
  X,
  FileText,
  Repeat,
  LayoutTemplate,
  ArrowRight,
  ArrowLeft,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { isPMS_HR, isPMS_Manager, getPmsRole } from "../utils/pmsrolecheck";
import ITR_LOGO from "/ITR_MINI.png";

const isHR = (user) => isPMS_HR(user);
const isManager = (user) => isPMS_Manager(user);

const PMSNavbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const location = useLocation();
  const userEmail = user?.email || "user@undefined.com";
  const role = getPmsRole(user);
  const username = user?.name || user?.username || "Not getting Name";

  const isActive = (path) => location.pathname.startsWith(path);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const menuAccess = () => {
    if (isHR(user)) return ["MyKRA", "template", "emp-grp", "employeetemplate", "reports", "cycle"];
    if (isManager(user)) return ["reports", "cycle", "template", "employeetemplate", "MyKRA", "emp-grp"];
    return ["reports", "MyKRA"];
  };

  const menu = menuAccess();

  const getInitials = (name, email) => {
    if (name && name !== "Not getting Name") {
      const parts = name.trim().split(" ");
      return ((parts[0]?.[0] || "") + (parts[1]?.[0] || parts[0]?.[1] || "")).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  };

  const initials = getInitials(username, userEmail);

  useEffect(() => {
    const handler = (e) => {
      if (showDropdown && dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  const navItems = [
    {
      id: "MyKRA",
      label: "My KRA",
      icon: LayoutTemplate,
      path: "/mytemplate",
      show: menu.includes("MyKRA"),
    },
    {
      id: "employeetemplate",
      label: "Create KRA & KPI",
      icon: LayoutTemplate,
      path: "/employeetemplate",
      show: menu.includes("employeetemplate"),
    },
    {
      id: "user-kra-search",
      label: "User KRAs",
      icon: Users,
      path: "/user-kra-search",
      show: isHR(user) || isManager(user),
    },
    {
      id: "emp-grp",
      label: "Group",
      icon: UserRoundPlus,
      path: "/PMS-userGroup",
      show: menu.includes("emp-grp"),
    },
    {
      id: "cycle",
      label: "Cycle",
      icon: Repeat,
      path: "/pms/cycles",
      show: menu.includes("cycle"),
    },
    {
      id: "reports",
      label: "Review",
      icon: FileText,
      path: "/PMS-reports",
      show: menu.includes("reports"),
    },
  ];

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="sticky top-0 z-50 h-15 overflow-visible bg-gradient-to-r from-white via-white to-gray-50 flex items-center justify-between px-6 md:px-12 shadow-xs border-b border-gray-200/50 backdrop-blur-sm"
      >
        <div className="flex items-center gap-2 md:gap-4">
          <motion.button
            onClick={() => navigate("/hub")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:text-violet-600 hover:bg-violet-50 transition-colors border border-gray-200 hover:border-violet-200"
            whileHover={{ x: -2 }}
            whileTap={{ scale: 0.95 }}
            title="Back to Hub"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Hub</span>
          </motion.button>

          <motion.div
            className="flex items-center gap-3"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <motion.div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => navigate("/mytemplate")}
              whileHover={{ x: 2 }}
            >
              <motion.img
                src={ITR_LOGO}
                alt="PMS Logo"
                className="h-10 w-10 object-contain"
                whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5 }}
              />
              <span className="font-bold text-xl bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                PMS
              </span>
            </motion.div>
          </motion.div>
        </div>

        <nav className="hidden md:flex items-center gap-2">
          {navItems
            .filter((item) => item.show)
            .map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <motion.button
                  key={item.id}
                  onClick={() => navigate(item.path)}
                  className={`
                    relative flex items-center gap-2 px-4 py-2
                    text-sm font-medium rounded-lg
                    transition-all duration-300
                    ${active
                      ? "text-violet-600 bg-violet-50"
                      : "text-gray-600 hover:text-violet-600 hover:bg-gray-50"
                    }
                  `}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                  {active && (
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-600 to-purple-600 rounded-full"
                      layoutId="activeTab"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </motion.button>
              );
            })}
        </nav>

        <div className="flex items-center gap-1">
          <div className="relative" ref={dropdownRef}>
            <motion.div
              onClick={() => setShowDropdown((v) => !v)}
              className="bg-gradient-to-br from-violet-600 to-purple-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold cursor-pointer shadow-lg hover:shadow-xl transition-all duration-300"
              whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
              whileTap={{ scale: 0.9 }}
            >
              {initials}
            </motion.div>

            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 top-14 w-80 bg-white rounded-2xl shadow-2xl p-6 z-50 border border-gray-100"
                >
                  <button
                    onClick={() => setShowDropdown(false)}
                    className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>

                  <div className="flex flex-col items-center mb-4">
                    <motion.div
                      className="w-16 h-16 bg-gradient-to-br from-violet-100 to-purple-100 rounded-full flex items-center justify-center mb-3 shadow-lg"
                      whileHover={{ scale: 1.1, rotate: 360 }}
                      transition={{ duration: 0.5 }}
                    >
                      <User className="w-8 h-8 text-violet-600" />
                    </motion.div>
                    <h3 className="font-bold text-lg text-gray-800">{username}</h3>
                    <p className="text-xs text-gray-500 mt-1">{userEmail}</p>
                    <motion.div
                      className="mt-2 px-3 py-1 rounded-full bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200"
                      whileHover={{ scale: 1.05 }}
                    >
                      <p className="text-xs font-semibold text-violet-700">
                        Assignment Type: {role.charAt(0).toUpperCase() + role.slice(1)}
                      </p>
                    </motion.div>
                  </div>

                  <div className="my-4 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">
                      Switch Application
                    </p>
                    <motion.button
                      onClick={() => navigate("/timesheet")}
                      className="w-full py-3 rounded-xl text-sm font-medium bg-gradient-to-r from-gray-50 to-gray-100 hover:from-violet-50 hover:to-purple-50 text-gray-700 hover:text-violet-700 border border-gray-200 hover:border-violet-200 transition-all duration-300 flex items-center justify-center gap-2"
                      whileHover={{ scale: 1.02, x: 4 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <span>Go to Timesheet</span>
                      <ArrowRight className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                      onClick={() => navigate("/hub")}
                      className="w-full mt-2 py-3 rounded-xl text-sm font-medium bg-gradient-to-r from-gray-50 to-gray-100 hover:from-violet-50 hover:to-purple-50 text-gray-700 hover:text-violet-700 border border-gray-200 hover:border-violet-200 transition-all duration-300 flex items-center justify-center gap-2"
                      whileHover={{ scale: 1.02, x: 4 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <span>Back to Hub</span>
                      <ArrowRight className="w-4 h-4" />
                    </motion.button>
                  </div>

                  <button
                    className="mt-1 w-full py-2.5 rounded-xl text-sm font-medium
                               flex items-center justify-center gap-2
                               bg-red-50 text-red-600
                               hover:bg-red-500 hover:text-white
                               transition-all duration-200"
                    onClick={() => setShowLogoutConfirm(true)}
                  >
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.header>

      {showLogoutConfirm && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 border border-gray-200/60">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <LogOut className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="font-semibold text-gray-900 text-base">Confirm Logout</h3>
              <p className="text-sm text-gray-500">Are you sure you want to logout?</p>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium
                           bg-gray-100 text-gray-700
                           hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => logout()}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium
                           bg-red-500 hover:bg-red-600 text-white transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default PMSNavbar;
