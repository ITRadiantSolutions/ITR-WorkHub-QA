import { motion } from "framer-motion";
import { isPMS_Employee, isPMS_HR, isPMS_Manager } from "../../utils/pmsrolecheck";
 
export default function HeaderSwitch({ viewMode, setViewMode, user }) {
  let modes = [];

  switch (true) {
    case isPMS_Employee(user):
      modes = ["my"];
      break;

    case isPMS_Manager(user):
    case isPMS_HR(user):
      modes = ["my", "employees"];
      break;

    default:
      modes = [];
  }

  if (modes.length <= 1) return null;

  const activeIndex = modes.indexOf(viewMode);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-end mb-6"
    >
      <div className="relative flex items-center rounded-xl bg-gray-100 p-1.5 shadow-inner border border-gray-200">
        <motion.div
          className="absolute top-1.5 bottom-1.5 left-1.5 rounded-lg bg-white shadow-md"
          style={{
            width: `calc(100% / ${modes.length} - 8px)`,
          }}
          animate={{
            x: activeIndex * 100 + "%",
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
          }}
        />

        {modes.map((mode) => {
          const active = viewMode === mode;

          return (
            <motion.button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`
                relative z-10 px-6 py-2.5 text-sm font-semibold transition-colors duration-200 rounded-lg
                ${active
                  ? "text-blue-700"
                  : "text-gray-600 hover:text-gray-800"
                }
              `}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {mode === "my" ? "My Review" : "Employee Reviews"}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
