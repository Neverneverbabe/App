import React from 'react';

const NetflixModal = () => {
  return (
    <div className="w-full max-w-3xl mx-auto bg-zinc-900 text-white rounded-lg overflow-hidden shadow-xl animate-fadeIn">
      <div className="relative h-60 md:h-72">
        <img
          src="/images/predator.jpg"
          alt="Predator: Killer of Killers"
          className="w-full h-full object-cover"
        />

        {/* Overlay content */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/50 to-transparent p-4 flex flex-col justify-end">
          <h1 className="text-white text-2xl md:text-3xl font-bold mb-2">
            Predator: Killer of Killers
          </h1>
          <div className="flex flex-wrap gap-2 text-white text-xs">
            {['2025', 'R', 'Movie', 'Animation', 'Action', 'Science Fiction'].map((tag) => (
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

      <div className="p-6">

        <p className="text-sm text-zinc-300 mb-6 leading-relaxed">
          When an old acquaintance is murdered, Wolff is compelled to solve the
          case. Realizing more extreme measures are necessary, Wolff recruits
          his estranged and highly lethal brother, Brax, to help. In partnership
          with Marybeth Medina, they uncover a deadly conspiracy, becoming
          targets of a ruthless network of killers who will stop at nothing to
          keep their secrets buried.
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
  );
};

export default NetflixModal;
