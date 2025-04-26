import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Link } from "@tanstack/react-router";

export default function LandingPage() {
    const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);
    
    const features = [
        {
            title: "AI Workflow Generation",
            description: "Create complex n8n workflows with simple natural language prompts.",
            icon: "✨",
        },
        {
            title: "Custom n8n Instances",
            description: "Connect to your own n8n instances with secure authentication.",
            icon: "🔗",
        },
        {
            title: "RAG-Enhanced Intelligence",
            description: "Leverage retrieval-augmented generation for context-aware workflows.",
            icon: "🧠",
        },
        {
            title: "Modern UI/UX",
            description: "Enjoy a seamless experience with our React, shadcn/ui powered interface.",
            icon: "🎨",
        },
    ];

    return (
        <div className="flex flex-col min-h-screen">
            {/* Hero Section */}
            <section className="bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 py-20">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
                        <div className="max-w-xl">
                            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                                <span className="text-blue-600 dark:text-blue-400">n8n</span> Workflow 
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600"> AI Generator</span>
                            </h1>
                            <p className="mt-4 text-xl text-gray-600 dark:text-gray-300">
                                Generate powerful n8n workflows using natural language. Connect to your instances and let AI do the heavy lifting.
                            </p>
                            <div className="mt-8 flex flex-col sm:flex-row gap-4">
                                <Link to="/app">
                                    <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
                                        Get Started
                                    </Button>
                                </Link>
                                <Button size="lg" variant="outline" className="border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800">
                                    Learn More
                                </Button>
                            </div>
                        </div>
                        <div className="w-full max-w-md rounded-xl bg-white p-2 shadow-2xl ring-1 ring-gray-900/10 dark:bg-gray-800 dark:ring-gray-700/10">
                            <div className="overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-900 p-4">
                                <div className="flex items-center space-x-2 pb-4 border-b border-gray-200 dark:border-gray-700">
                                    <div className="h-3 w-3 rounded-full bg-red-500"></div>
                                    <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                                    <div className="h-3 w-3 rounded-full bg-green-500"></div>
                                    <div className="ml-2 text-xs text-gray-500 dark:text-gray-400">n8n-intelligence</div>
                                </div>
                                <div className="mt-4 space-y-2 text-sm text-gray-800 dark:text-gray-200">
                                    <div className="font-mono">
                                        <span className="text-blue-500">&gt;</span> Create a workflow to send weekly reports from Google Sheets to Slack
                                    </div>
                                    <div className="pl-4 font-mono text-gray-600 dark:text-gray-400">
                                        ⠋ Generating workflow...
                                    </div>
                                    <div className="pl-4 font-mono text-green-500">
                                        ✓ Workflow created! Added Google Sheets, Slack nodes and scheduled trigger
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-16 bg-white dark:bg-gray-900">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
                    <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
                        Powerful <span className="text-blue-600 dark:text-blue-400">Features</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {features.map((feature, index) => (
                            <div 
                                key={index}
                                className={`p-6 rounded-xl transition-all duration-200 ${
                                    hoveredFeature === index 
                                        ? "shadow-lg bg-blue-50 dark:bg-gray-800 transform -translate-y-1" 
                                        : "shadow border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900"
                                }`}
                                onMouseEnter={() => setHoveredFeature(index)}
                                onMouseLeave={() => setHoveredFeature(null)}
                            >
                                <div className={`text-4xl mb-4 ${
                                    hoveredFeature === index ? "scale-110" : ""
                                } transition-transform duration-200`}>
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                    {feature.title}
                                </h3>
                                <p className="text-gray-600 dark:text-gray-300">
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section className="py-16 bg-gray-50 dark:bg-gray-800">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
                    <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
                        How It <span className="text-blue-600 dark:text-blue-400">Works</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="flex flex-col items-center text-center p-6">
                            <div className="w-16 h-16 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-2xl mb-4">
                                1
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                Connect Your n8n Instance
                            </h3>
                            <p className="text-gray-600 dark:text-gray-300">
                                Enter your n8n API endpoint and authentication credentials securely.
                            </p>
                        </div>
                        <div className="flex flex-col items-center text-center p-6">
                            <div className="w-16 h-16 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-2xl mb-4">
                                2
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                Describe Your Workflow
                            </h3>
                            <p className="text-gray-600 dark:text-gray-300">
                                Use natural language to tell AI what automation you want to build.
                            </p>
                        </div>
                        <div className="flex flex-col items-center text-center p-6">
                            <div className="w-16 h-16 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-2xl mb-4">
                                3
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                Deploy & Run
                            </h3>
                            <p className="text-gray-600 dark:text-gray-300">
                                Review the generated workflow, make any adjustments, and deploy it directly to your n8n instance.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-16 bg-blue-600 dark:bg-blue-800">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl text-center">
                    <h2 className="text-3xl font-bold text-white mb-4">
                        Ready to Automate with AI?
                    </h2>
                    <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
                        Start generating powerful n8n workflows in minutes using natural language prompts.
                    </p>
                    <Link to="/app">
                        <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50">
                            Get Started Now
                        </Button>
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
                    <div className="flex flex-col md:flex-row justify-between items-center">
                        <p className="text-gray-600 dark:text-gray-400 mb-4 md:mb-0">
                            © {new Date().getFullYear()} n8n Intelligence. All rights reserved.
                        </p>
                        <div className="flex space-x-6">
                            <a href="#" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                                Terms
                            </a>
                            <a href="#" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                                Privacy
                            </a>
                            <a href="#" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                                Contact
                            </a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}