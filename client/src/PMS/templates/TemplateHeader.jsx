import { motion } from "framer-motion";
import { isPMS_HR } from "../../utils/pmsrolecheck";
 
export default function TemplateHeader({
  loggedInUser,
  templateView = "my",
  setTemplateView,
}) {
  if (!isPMS_HR(loggedInUser)) return null;

  const isMyView = templateView === "my";
  const isEmployeeView = templateView === "employees";

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mb-6 px-4"
    >
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
          KPI Templates
        </h1>
      </div>

      <div className="flex justify-end">
        <div className="relative flex items-center p-1 rounded-xl bg-gray-100 border border-gray-200 shadow-inner">
          {/* Animated Background */}
          <motion.div
            className="absolute top-1 left-1 h-[36px] w-[140px] rounded-lg bg-white shadow-md"
            animate={{
              x: isEmployeeView ? 140 : 0,
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
            }}
          />

          {/* Buttons */}
          <button
            onClick={() => setTemplateView("my")}
            className={`relative z-10 w-[140px] h-[36px] text-sm font-semibold transition-colors duration-200 ${isMyView
                ? "text-violet-700"
                : "text-gray-500 hover:text-gray-700"
              }`}
          >
            My Templates
          </button>

          <button
            onClick={() => setTemplateView("employees")}
            className={`relative z-10 w-[160px] h-[36px] text-sm font-semibold transition-colors duration-200 ${isEmployeeView
                ? "text-violet-700"
                : "text-gray-500 hover:text-gray-700"
              }`}
          >
            Employee Templates
          </button>
        </div>
      </div>
    </motion.div>
  );
}
