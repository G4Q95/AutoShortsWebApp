import Link from 'next/link';

/**
 * Application footer component that displays branding and copyright information.
 * 
 * Features:
 * - Centered layout with app description
 * - Dynamic copyright year
 * - Responsive design
 * 
 * Layout:
 * - App name and description
 * - Copyright notice with current year
 * 
 * Styling:
 * - Light gray background
 * - Subtle border top
 * - Consistent text styling
 * - Responsive padding and spacing
 * 
 * @example
 * ```tsx
 * // Basic usage in app layout
 * <Footer />
 * ```
 */
export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center text-center">
          <div className="max-w-md mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Auto Shorts</h3>
            <p className="text-sm text-gray-600">
              Create engaging short-form videos automatically from online content.
            </p>
          </div>

          {/* Simple copyright notice */}
          <div className="border-t border-gray-200 mt-4 pt-4 w-full">
            <p className="text-sm text-gray-600 text-center">
              &copy; {new Date().getFullYear()} Auto Shorts. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
