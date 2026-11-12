Put your own files here.

PHOTOS (gallery)
  1. Copy your pictures into media/photos/  (jpg, png or webp, ideally under 500 KB each)
     Use simple file names: letters, numbers, - and _ only (no accents). Example: cafe-atlas-2019.jpg
  2. In js/game.js, find "var PHOTOS" and add img:'media/photos/yourfile.jpg' to the photo it replaces:
       {e:'🍵',img:'media/photos/cafe-atlas-2019.jpg',a:'#17a24f',b:'#06301a',d:'2019-03-16T17:42',place:'Café Atlas',people:'Yassir, Rayan'},
     d (date), place and people are what the Info button shows. Keep the Café Atlas 2019 photo:
     it is the clue for the note password (atlas2019).

After adding files, rebuild the Docker image (docker build ...) so they are inside it.
