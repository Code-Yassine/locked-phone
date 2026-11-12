/*
 * The Locked Phone — game settings
 * Edit these two values before you deploy. Every device that opens the game uses them.
 *
 * A device where someone saved settings in the Game master panel (open the site with #gm
 * at the end of the address) keeps its own saved values instead of these.
 */
window.GAME_CONFIG = {
  // The flag shown on the final screen once a team opens the last lock.
  flag: 'n7sec{3a572180f81e0ea8}',

  // How many minutes a full battery lasts on its own (wrong answers and hints drain it faster).
  // Allowed range: 20 to 240.
  batteryMinutes: 60
};
