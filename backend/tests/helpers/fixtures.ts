import { MuseumStatus } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';

export async function seedAdwaFixture() {
  const museum = await prisma.museum.create({
    data: {
      name: 'Adwa Test Museum',
      slug: 'adwa-test',
      status: MuseumStatus.ACTIVE,
    },
  });

  const room2 = await prisma.room.create({
    data: {
      museumId: museum.id,
      legacyId: 'room_2',
      storyOrder: 2,
      title: 'The Call to Arms',
      roomOverviewText: 'Mobilization begins after the Treaty of Wuchale is rejected.',
      narrationScript: 'Welcome to The Call to Arms.',
    },
  });

  const room1 = await prisma.room.create({
    data: {
      museumId: museum.id,
      legacyId: 'room_1',
      storyOrder: 1,
      title: 'The Gathering Storm',
      roomOverviewText:
        'In the late 19th century, European powers carved up Africa. Emperor Menelik II signed the Treaty of Wuchale.',
      narrationScript: 'Welcome to The Gathering Storm.',
      roomAudioUrl: null,
      nextRoomId: room2.id,
    },
  });

  const treatyItem = await prisma.item.create({
    data: {
      roomId: room1.id,
      legacyId: 'room_1_treaty',
      name: 'The Treaty of Wuchale (Article XVII)',
      shortDescription: 'The dual-language document that sparked the war.',
      detailText:
        'Signed on May 2, 1889. The Amharic version stated the Emperor could use Italian diplomacy, while the Italian version claimed a protectorate.',
      imageUrl: 'https://placehold.co/400x300?text=Treaty',
      displayOrder: 0,
    },
  });

  const mapItem = await prisma.item.create({
    data: {
      roomId: room1.id,
      legacyId: 'room_1_map',
      name: 'Map of the Scramble for Africa',
      shortDescription: 'Visualizing European colonial ambitions.',
      detailText: 'Map showing European powers dividing Africa during the 1884 Berlin Conference.',
      imageUrl: null,
      displayOrder: 1,
    },
  });

  const suspendedMuseum = await prisma.museum.create({
    data: { name: 'Suspended Museum', slug: 'suspended-test', status: MuseumStatus.SUSPENDED },
  });

  const suspendedRoom = await prisma.room.create({
    data: {
      museumId: suspendedMuseum.id,
      storyOrder: 1,
      title: 'Suspended Room',
      roomOverviewText: 'Content from a suspended museum.',
      narrationScript: 'This should never be reachable.',
    },
  });

  return { museum, room1, room2, treatyItem, mapItem, suspendedMuseum, suspendedRoom };
}
