import 'package:flutter/material.dart';

import 'stitch_routes.dart';
import 'stitch_theme.dart';

class StitchMuseumHubScreen extends StatelessWidget {
  const StitchMuseumHubScreen({super.key, this.showBottomNav = true});

  final bool showBottomNav;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: StitchTheme.parchmentLight,
      body: SafeArea(
        child: CustomScrollView(
          slivers: <Widget>[
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 10, 24, 10),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: <Widget>[
                    const CircleAvatar(
                      radius: 20,
                      backgroundImage: NetworkImage(
                        'https://lh3.googleusercontent.com/aida-public/AB6AXuCBJLqsIZleBoTbgXtq6I1lgC4geIj9-CA33Pll68CYhc_ouplxlvGETPTAJ1-0GEIhPXOQqAyBFjx2gjxQc9s6bNGT_btCaJaIC4w4V_ogaIpc2VJes_h3SbkEduGBYOzwZzkIdwDyUpfXRU9k3wqyTJTbgOOU4QO0Ja9j_7GOaSpZJQmo2b94yV4YsqM9nwYEc_uIh3T8xUJV6WcigKznYN2gsxR934_5BFM3-fGnpqQxAGR8JX_jp2_bLBlGwepyHbC-a7sdRlv0',
                      ),
                    ),
                    Text(
                      'THE GALLERY',
                      style: StitchTheme.headline(
                        size: 24,
                        color: StitchTheme.darkText,
                        letterSpacing: 2.5,
                      ),
                    ),
                    IconButton(
                      onPressed: () {},
                      icon: const Icon(Icons.near_me_outlined),
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(28),
                  child: Stack(
                    children: <Widget>[
                      SizedBox(
                        height: 500,
                        width: double.infinity,
                        child: Image.network(
                          'https://lh3.googleusercontent.com/aida-public/AB6AXuAglmNP8M5sSWoURD4f0l9YtehSqFHMqb32cEecwTO0nrVOe3p8TpYWx59bxn6eYNSK5efa0xhiCex_Hsgzv7RP4a3FM0sBP4PrB9d6zwn8uYhwOG6IzgiIGzToBmwfftp2S-uYXM-uaWVcIffW93TEIp19wvMKaHl27825B2kr3ziuxwBnerasui73F9QgCgDFkSesJ4TjSl0SVDgWx0Cabb6LCPj_0HcrvmQQTFcgXb_pXUgzY5lsdT93OVvg_RMivSzfeCa178E1',
                          fit: BoxFit.cover,
                        ),
                      ),
                      Positioned.fill(
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: <Color>[
                                Colors.transparent,
                                StitchTheme.parchmentLight.withValues(alpha: 0.65),
                                StitchTheme.parchmentLight.withValues(alpha: 0.95),
                              ],
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        left: 20,
                        right: 20,
                        bottom: 24,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.8),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                'CURRENT EXHIBITION',
                                style: StitchTheme.overline(
                                  size: 11,
                                  color: StitchTheme.darkText,
                                ),
                              ),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              'Antiquity & Light',
                              style: StitchTheme.headline(
                                size: 48,
                                color: StitchTheme.darkText,
                                height: 1.0,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Explore the interplay of shadow and form in our newly curated collection of Hellenistic marbles.',
                              style: StitchTheme.body(
                                size: 17,
                                color: StitchTheme.darkText.withValues(alpha: 0.8),
                                height: 1.45,
                              ),
                            ),
                            const SizedBox(height: 14),
                            FilledButton.icon(
                              onPressed: () {
                                Navigator.pushNamed(context, StitchRoutes.narration);
                              },
                              style: FilledButton.styleFrom(
                                backgroundColor: StitchTheme.adwaGold,
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
                              ),
                              label: const Text('Enter Gallery'),
                              icon: const Icon(Icons.arrow_forward),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 28, 24, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      'Curated Collections',
                      style: StitchTheme.headline(
                        size: 30,
                        weight: FontWeight.w500,
                        color: StitchTheme.darkText,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Hand-selected pieces from the archives',
                      style: StitchTheme.body(
                        size: 15,
                        color: StitchTheme.slate.withValues(alpha: 0.8),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: SizedBox(
                height: 320,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  children: const <Widget>[
                    _CollectionCard(
                      image:
                          'https://lh3.googleusercontent.com/aida-public/AB6AXuDP4BrTPHHvdT8TVzivVliPKsn3u87R_MOgzKTVPVOCvX9-xNcAulByvIBb-IwQKunsb7abp-cuG5-v6uJ2NdbDD9ol-uWFSNoZG9gEbPahG8FO6eUbgVmrK1pEKVL86sUetN7euX5c5qZcrvYSbdaixDIKFIeRhpfFx3sQ7AJ6jlqvP6vemsAubn5ekLt9V5tiYFtHsHww_7QtHjM-ELcRmMIr06sh5Oy6dM70IUPxt1wEZhlrzdNGwgCdc6qiVPbVQ66WT0UBYgBO',
                      title: 'Renaissance Textures',
                      subtitle: '12 Pieces',
                    ),
                    _CollectionCard(
                      image:
                          'https://lh3.googleusercontent.com/aida-public/AB6AXuALbMqVN0-M_uRV4etCYfJDjEUG40TWxFHAWrFGwcVzBoIUfMo1-pQMZvT9ui3ekwHnEMoaHZLDKgL1ABuXwJ3z44_rDhx2ICxm7mX-nkdDulDBAb8x2wJwfmC0LXmNpurOA9t_5volEeVciZDob0oecIsqYrtvWU0Blnbqgs6P7Kx_ykPyN7-j7giXNByIqQYM6CjRiM3blgsNZJEINCavk9JWDVUCSwJKbC_aYsvCyUAnK2n5FBFeeXJ-h74MAAO5hfjZbnxVfit6',
                      title: 'The Gold Room',
                      subtitle: '8 Artifacts',
                    ),
                    _CollectionCard(
                      image:
                          'https://lh3.googleusercontent.com/aida-public/AB6AXuAde5U_fpGAKRQXfLosXCVdq0IGj4iYa9Ugjl10_uBQYwemTy4-b4oIxoX-NJOO9sW4xGBdmvqOP23Emonc2k7dGG9mSdPB7eCmvlE6c_5kB6EKIJC4ESc8AriQx1FEh1ekWNsYqZOvkyDO4XMu0VxwCafIcUeGCkX8xbLc4E8xInnV8txUdeUaenaueBE4oSWE2sbx2-ulwsrnUl7wSPkuIbpJtolcPTl6nz7ooxaBdPlSR6yrxjqDVBrz72HvXg2tryM2sl0uUQeP',
                      title: 'Bronze Age Forms',
                      subtitle: '24 Sculptures',
                    ),
                  ],
                ),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 110)),
          ],
        ),
      ),
      bottomNavigationBar: showBottomNav
          ? const StitchBottomNav(activeIndex: 0, lightMode: true)
          : null,
    );
  }
}

class _CollectionCard extends StatelessWidget {
  const _CollectionCard({
    required this.image,
    required this.title,
    required this.subtitle,
  });

  final String image;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 270,
      margin: const EdgeInsets.only(right: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: Stack(
                fit: StackFit.expand,
                children: <Widget>[
                  Image.network(image, fit: BoxFit.cover),
                  Positioned(
                    top: 12,
                    right: 12,
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.7),
                        shape: BoxShape.circle,
                      ),
                      padding: const EdgeInsets.all(8),
                      child: const Icon(Icons.bookmark_border),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            title,
            style: StitchTheme.headline(
              size: 22,
              color: StitchTheme.darkText,
              weight: FontWeight.w500,
            ),
          ),
          Text(
            subtitle,
            style: StitchTheme.body(
              size: 14,
              color: StitchTheme.slate.withValues(alpha: 0.75),
            ),
          ),
        ],
      ),
    );
  }
}
