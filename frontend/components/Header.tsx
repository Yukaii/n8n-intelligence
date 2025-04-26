import { Link } from "@tanstack/react-router";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useAuth,
} from "@clerk/clerk-react";
import { useMemo } from "react";

export function Header() {
  const { isSignedIn } = useAuth();
  const homePath = useMemo(() => (isSignedIn ? "/home" : "/"), [isSignedIn]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to={homePath}>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
              n8n
            </span>
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              Intelligence
            </span>
          </div>
        </Link>
        <nav className="flex items-center gap-6">
          <SignedIn>
            <Link
              to="/app"
              className="text-sm font-medium text-gray-700 transition-colors hover:text-blue-600 dark:text-gray-200 dark:hover:text-blue-400 [&.active]:text-blue-600 [&.active]:font-semibold dark:[&.active]:text-blue-400"
            >
              App
            </Link>
          </SignedIn>
          <SignedOut>
            <span className="text-sm font-medium text-gray-700 transition-colors hover:text-blue-600 dark:text-gray-200 dark:hover:text-blue-400 cursor-pointer">
              <SignInButton mode="modal" />
            </span>
          </SignedOut>
          <SignedIn>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  userButtonAvatarBox: "w-8 h-8",
                  userButtonPopoverActionButton:
                    "text-sm font-medium text-gray-700 transition-colors hover:text-blue-600 dark:text-gray-200 dark:hover:text-blue-400",
                },
              }}
            />
          </SignedIn>
        </nav>
      </div>
    </header>
  );
}
