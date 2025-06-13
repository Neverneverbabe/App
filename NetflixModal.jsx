import React from 'react';

const NetflixModal = ({
  imageSrc,
  title,
  tags,
  description,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
      <div className="relative w-full max-w-3xl bg-zinc-900 text-white rounded-lg overflow-hidden shadow-xl animate-fadeIn">

        {/* ❌ Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 text-white text-2xl font-bold hover:text-red-500"
        >
          ×
        </button>

        {/* ✅ Image with Overlay */}
        <div className="relative h-60 md:h-72">
          <img
            src={imageSrc}
            alt={title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-b from-black/90 via-black/60 to-transparent animate-slideUp">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">{title}</h1>
            <div className="flex flex-wrap gap-2 text-xs">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-white/20 px-2 py-1 rounded-md backdrop-blur-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 📝 Content */}
        <div className="p-6">
          <p className="text-sm text-zinc-300 mb-6 leading-relaxed">
            {description}
          </p>
          <div className="flex flex-wrap gap-3">
            <button className="bg-zinc-700 hover:bg-zinc-600 transition px-4 py-2 rounded text-sm">
              Mark as Seen
            </button>
            <button className="bg-blue-600 hover:bg-blue-500 transition px-4 py-2 rounded text-sm">
              Add to Watchlist
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetflixModal;
