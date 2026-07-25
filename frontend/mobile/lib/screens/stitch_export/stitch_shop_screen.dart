import 'package:flutter/material.dart';

import 'stitch_routes.dart';
import 'stitch_theme.dart';

class StitchShopScreen extends StatelessWidget {
  const StitchShopScreen({super.key, this.showBottomNav = true});

  final bool showBottomNav;

  void _openProductDetail(BuildContext context) {
    Navigator.pushNamed(context, StitchRoutes.shopProduct);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: StitchTheme.parchment,
      body: CustomScrollView(
        slivers: <Widget>[
          SliverToBoxAdapter(
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 12, 24, 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: <Widget>[
                    const CircleAvatar(
                      radius: 20,
                      backgroundImage: NetworkImage(
                        'https://lh3.googleusercontent.com/aida-public/AB6AXuD-FGBeE_OYU_L2yYjxfL8V-uXWMARUtMUp9UkPgZQqlOEUoTRLqJtRJ09EHujUJw6uXBbRP6epAM8eDNQmDVtTHtxgnrT7dptrRkmFtHIbqx0A6aYI1Q6afKcaSSA-KYzyDZMYALNU8vl7MVmzQk13fcqHJ_X1kj1xyxlklYrc-N4X-iTFwDJE8j0qezCZaxGRHAqQI27vWi-l_Mql6xMOtdWJmwxKgqJNaaPtYhHW-iDP2KIStXgDhPwcqR5MLww6lQeeTca4xSO2',
                      ),
                    ),
                    Text(
                      'THE GALLERY',
                      style: StitchTheme.headline(
                        size: 22,
                        color: StitchTheme.slate,
                        letterSpacing: 2.6,
                      ),
                    ),
                    IconButton(
                      onPressed: () {
                        Navigator.pushNamed(context, StitchRoutes.shopEmptyBag);
                      },
                      icon: const Icon(Icons.shopping_bag_outlined),
                    ),
                  ],
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.only(top: 8, bottom: 24),
              child: Column(
                children: <Widget>[
                  Text(
                    'Museum Shop',
                    style: StitchTheme.headline(
                      size: 32,
                      color: StitchTheme.slate,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'CURATED COLLECTIONS & EDITIONS',
                    style: StitchTheme.overline(
                      size: 11,
                      color: StitchTheme.slate.withValues(alpha: 0.7),
                    ),
                  ),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
            sliver: SliverGrid(
              delegate: SliverChildListDelegate(
                <Widget>[
                  _featuredCard(context),
                  _smallCard(
                    context,
                    image:
                        'https://lh3.googleusercontent.com/aida-public/AB6AXuBEUwBo8Zg0XzsLy9k-BcwncJvAtI7y6eHV4eNhggIEhpNDhn9trWHtpEYswJJDMsoTFyfdkHJ_KN9CI88LnnrPwOPJ5HYpsC56pB5kx1VhLOqfPtyRaGJGVFEpJF9oR3qWIJY-didl7U55EdA5vcoeFVF65Q7UC22VYFSd_JaxuCSq7cTXCEK_3z3P8t0xD7qXv-rGW7kgDU30DlVbOkVPEeAiVRnlENfhxGb8fhr-nWZLNO1MS_57eX_FKQxpQAIQM2wzvA14gbbz',
                    title: 'Miniature Apollo Bust',
                    subtitle: 'Cast marble resin replica.',
                    price: '\$85.00',
                  ),
                  _smallCard(
                    context,
                    image:
                        'https://lh3.googleusercontent.com/aida-public/AB6AXuD5w_Wn9dm9q07-ru4KQqVjz4fSF1_-03vp5ZVMOwMy0DlfFpZFkX4MewVP3XgR6tNvAhwuBVogeDTlwf8ayk6OKOyAIMrDESn3gjfCXeAtUuhrKd7BxRd55XKliIMATunB5YwmBBu1G8-hiB2iaoytFtQwmhOu4XI_x1cqWn_vqJGH-_dnfnhk6FTQxMhZ5VZEWHON1PfhlktCmG0W309hM8TLkOMQKdsklzuyWBytsTlV8qWIrIrgkAz1WNadnEx6qXFRNy9WUEdn',
                    title: 'Exhibition Poster',
                    subtitle: 'Archival lithograph.',
                    price: '\$40.00',
                  ),
                  _smallCard(
                    context,
                    image:
                        'https://lh3.googleusercontent.com/aida-public/AB6AXuBTGIXFp07bcsz2XKrcDnIIZA5F12YQngmuR6S47ZHAsLlzObrettLZ2ZGu1D955hN7_QC7YjbGki6a2_iwN7eXigBTDOSQVWMTBLHaFf8zZWubF45bvCSrwZnW_J8txc8EqEIuFnN0hTtxoCA807vLH0WKKF8J4qyNscc5vSi-mOsOSpBXcj8t0d65AZoHqK_GVKmzad27jET0Wirm7kU9B26b-gC7l5CzRLdeNpR57IKJpWvo2_WoAGkTWZLWBOGmygVLMLdw20RS',
                    title: 'Artisan Gallery Mug',
                    subtitle: 'Hand-thrown ceramic.',
                    price: '\$28.00',
                  ),
                  _smallCard(
                    context,
                    image:
                        'https://lh3.googleusercontent.com/aida-public/AB6AXuDgZ4pdpgrdrogeYd77e4lRFfMKfoiU8WNSlGNo-77--H2aMy4C0vyCrk-NEBcF3zfiT-2qOqbTKSHa_IiFcwmGvIb1wFYbhxE2nnnKBmsFlSZFNEGRCEhKOgWkj8AE3TO2zNxFwRzEXLCZjpxcBkGvL0qT5Aa1jrCZ3DIMpCAUhmwyzXCLtZ13Lsqjs7H1rWwIavR873r4CKiE_AcsplxcKQdPKawaKYW_CzaPNaFQ4Nx3WhN5_hCRUvsvngez-X_5wa2cjMBbx7sl',
                    title: 'Signature Canvas Tote',
                    subtitle: 'Heavyweight cotton.',
                    price: '\$35.00',
                  ),
                ],
              ),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 0.64,
                crossAxisSpacing: 16,
                mainAxisSpacing: 16,
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: showBottomNav
          ? const StitchBottomNav(activeIndex: 1, lightMode: true)
          : null,
    );
  }

  Widget _featuredCard(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _openProductDetail(context),
        child: Container(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Stack(
                    fit: StackFit.expand,
                    children: <Widget>[
                      Image.network(
                        'https://lh3.googleusercontent.com/aida-public/AB6AXuCMpQjjC2cEjuaCx7_FwKmLEeTiuLMgLT4vC3gMh3UejWh4ktMxjwt3G3w4_UQhXxpnNBsJuQbuhqe9_4wUOGVWhbjhhfT6TS06RnRuSjkVBLI11ohmkSLbZjNZu9QMR86yUYyBzkH9Nm-9-U7VLnTPKEnHu22n7Ps048elsEkZu5L-LHdfQNEAl8KItyOaY0x_T7nuQYsBCQi8tjx5Je3YnUrnVBgVavLqToJhCReTviDEjQXgmtX79FCpRV2u4m-RauTFExRquDye',
                        fit: BoxFit.cover,
                      ),
                      Positioned(
                        top: 10,
                        left: 10,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.85),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            'New Arrival',
                            style: StitchTheme.overline(
                              size: 10,
                              color: StitchTheme.adwaGold,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Renaissance Collection',
                style: StitchTheme.headline(
                  size: 18,
                  color: StitchTheme.slate,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '\$125.00',
                style: StitchTheme.body(
                  size: 20,
                  weight: FontWeight.w700,
                  color: StitchTheme.adwaGold,
                ),
              ),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: () => _openProductDetail(context),
                style: FilledButton.styleFrom(
                  backgroundColor: StitchTheme.adwaGold,
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(40),
                ),
                child: const Text('Add to Bag'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _smallCard(
    BuildContext context, {
    required String image,
    required String title,
    required String subtitle,
    required String price,
  }) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _openProductDetail(context),
        child: Container(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.network(image, fit: BoxFit.cover, width: double.infinity),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: StitchTheme.headline(size: 16, color: StitchTheme.slate),
              ),
              Text(
                subtitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: StitchTheme.body(
                  size: 12,
                  color: StitchTheme.slate.withValues(alpha: 0.7),
                ),
              ),
              const SizedBox(height: 6),
              Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      price,
                      style: StitchTheme.body(
                        size: 17,
                        weight: FontWeight.w700,
                        color: StitchTheme.adwaGold,
                      ),
                    ),
                  ),
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(color: StitchTheme.adwaGold),
                      shape: BoxShape.circle,
                    ),
                    padding: const EdgeInsets.all(6),
                    child: const Icon(
                      Icons.add,
                      size: 18,
                      color: StitchTheme.adwaGold,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
